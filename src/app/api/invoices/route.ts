import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  getAuthUser,
  parsePagination,
  requireSameOrigin,
} from "@/lib/api"
import { invoiceCreateSchema } from "@/lib/schemas/invoice"
import { recomputeInvoicePayment } from "@/lib/payments"
import { serializeInvoice } from "@/domain/billing/serialize"
import { deferActivityLog } from "@/lib/activity"
import { nextAutoNumber } from "@/lib/invoice-numbering"
import { getInvoicesFirstPage, invoicesTag } from "@/lib/data/invoices"
import { navTag } from "@/lib/data/nav"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const { cursor, limit } = parsePagination(req)
    if (!cursor && limit === 50) {
      return NextResponse.json(await getInvoicesFirstPage(user.id))
    }
    const rows = await prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        _count: { select: { lines: true } },
        payments: { select: { amount: true, paidAt: true } },
      },
    })
    const paged = buildPagedResponse(rows, limit)
    return NextResponse.json({
      data: paged.data.map(serializeInvoice),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const body = await req.json()
    const data = invoiceCreateSchema.parse(body)

    const year = new Date(data.issueDate).getFullYear()

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id },
      select: { id: true },
    })
    if (!client) return apiUnauthorized()

    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: data.projectId,
          userId: user.id,
          clientId: data.clientId,
        },
        select: { id: true },
      })
      if (!project) {
        return NextResponse.json(
          {
            error: "Bad Request",
            code: "INVALID_PROJECT_FOR_CLIENT",
          },
          { status: 400 },
        )
      }
    }

    const subtotal = data.lines.reduce(
      (s, l) => s + Number(l.qty) * Number(l.rate),
      0,
    )
    const total =
      data.totalOverride != null ? Number(data.totalOverride) : subtotal

    const created = await prisma.$transaction(async (tx) => {
      const number =
        data.number && data.number.trim()
          ? data.number.trim()
          : await nextAutoNumber(tx, user.id, year)

      if (data.number) {
        const conflict = await tx.invoice.findFirst({
          where: { userId: user.id, number },
          select: { id: true },
        })
        if (conflict) {
          throw new InvoiceNumberConflictError(number)
        }
      }

      const inv = await tx.invoice.create({
        data: {
          userId: user.id,
          clientId: data.clientId,
          projectId: data.projectId ?? null,
          number,
          status: data.status,
          kind: data.kind,
          issueDate: new Date(data.issueDate),
          dueDate: new Date(data.dueDate),
          subtotal,
          tax: 0,
          total,
          totalOverride:
            data.totalOverride != null ? Number(data.totalOverride) : null,
          notes: data.notes ?? null,
          lines: {
            create: data.lines.map((l, i) => ({
              taskId: l.taskId ?? null,
              label: l.label,
              qty: Number(l.qty),
              rate: Number(l.rate),
              position: i,
            })),
          },
        },
      })

      if (data.taskIds?.length) {
        await tx.task.updateMany({
          where: {
            id: { in: data.taskIds },
            userId: user.id,
            clientId: data.clientId,
          },
          data: { invoiceId: inv.id, status: "DONE" },
        })
      }

      if (data.initialPayment) {
        await tx.payment.create({
          data: {
            userId: user.id,
            invoiceId: inv.id,
            amount: data.initialPayment.amount,
            paidAt: new Date(data.initialPayment.paidAt),
            method: data.initialPayment.method ?? null,
            note: data.initialPayment.note ?? null,
          },
        })
        await recomputeInvoicePayment(inv.id, tx)
      }

      return inv
    })

    revalidateTag(invoicesTag(user.id), "max")
    revalidateTag(navTag(user.id), "max")
    deferActivityLog({
      userId: user.id,
      kind: data.status === "SENT" ? "INVOICE_SENT" : "INVOICE_CREATED",
      title:
        data.status === "SENT"
          ? `Facture ${created.number} émise`
          : `Brouillon ${created.number} créé`,
      meta: `${total.toFixed(2)} €`,
      clientId: created.clientId,
      invoiceId: created.id,
      projectId: created.projectId,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof InvoiceNumberConflictError) {
      return NextResponse.json(
        { error: `Le numéro de facture "${error.number}" est déjà utilisé` },
        { status: 409 },
      )
    }
    return apiServerError(error)
  }
}

class InvoiceNumberConflictError extends Error {
  constructor(public number: string) {
    super(`Invoice number conflict: ${number}`)
  }
}
