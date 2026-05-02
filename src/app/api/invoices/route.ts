import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { invoiceCreateSchema } from "@/lib/schemas/invoice"
import { getInvoiceComputed, recomputeInvoicePayment } from "@/lib/payments"
import { deferActivityLog } from "@/lib/activity"

function formatNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(4, "0")}`
}

/**
 * Reserve the next available invoice number for the given user. Tries the
 * sequence based on the current count of invoices and walks forward if there
 * are collisions (e.g. when the user previously typed a custom number that
 * happens to match the auto sequence).
 *
 * @returns a string number guaranteed to be unique for the user
 */
async function nextAutoNumber(userId: string, year: number): Promise<string> {
  const [takenNumbers, baseCount] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId, number: { startsWith: `${year}-` } },
      select: { number: true },
    }),
    prisma.invoice.count({ where: { userId } }),
  ])
  const taken = new Set(takenNumbers.map((r) => r.number))
  let seq = baseCount + 1024 + 1
  let candidate = formatNumber(year, seq)
  while (taken.has(candidate)) {
    seq += 1
    candidate = formatNumber(year, seq)
  }
  return candidate
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { issueDate: "desc" },
      include: {
        _count: { select: { lines: true } },
        payments: { select: { amount: true, paidAt: true } },
      },
    })
    return NextResponse.json({
      items: invoices.map((inv) => {
        const computed = getInvoiceComputed(inv)
        return {
          id: inv.id,
          number: inv.number,
          clientId: inv.clientId,
          projectId: inv.projectId,
          status: inv.status,
          paymentStatus: inv.paymentStatus,
          isOverdue: computed.isOverdue,
          kind: inv.kind,
          issueDate: inv.issueDate.toISOString(),
          dueDate: inv.dueDate.toISOString(),
          paidAmount: computed.paidAmount,
          balanceDue: computed.balanceDue,
          lastPaidAt: computed.lastPaidAt,
          subtotal: decimalToNumber(inv.subtotal) ?? 0,
          tax: decimalToNumber(inv.tax) ?? 0,
          total: decimalToNumber(inv.total) ?? 0,
          totalOverride: decimalToNumber(inv.totalOverride),
          notes: inv.notes,
          linesCount: inv._count.lines,
        }
      }),
    })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  try {
    const [user, body] = await Promise.all([getAuthUser(), req.json()])
    if (!user) return apiUnauthorized()
    const data = invoiceCreateSchema.parse(body)

    const year = new Date(data.issueDate).getFullYear()

    const [client, autoNumber] = await Promise.all([
      prisma.client.findFirst({
        where: { id: data.clientId, userId: user.id },
        select: { id: true },
      }),
      data.number && data.number.trim()
        ? Promise.resolve(data.number.trim())
        : nextAutoNumber(user.id, year),
    ])
    if (!client) return apiUnauthorized()
    const number = autoNumber

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

    if (data.number) {
      const conflict = await prisma.invoice.findFirst({
        where: { userId: user.id, number },
        select: { id: true },
      })
      if (conflict) {
        return NextResponse.json(
          { error: `Le numéro de facture "${number}" est déjà utilisé` },
          { status: 409 },
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

    deferActivityLog({
      userId: user.id,
      kind: data.status === "SENT" ? "INVOICE_SENT" : "INVOICE_CREATED",
      title:
        data.status === "SENT"
          ? `Facture ${number} émise`
          : `Brouillon ${number} créé`,
      meta: `${total.toFixed(2)} €`,
      clientId: created.clientId,
      invoiceId: created.id,
      projectId: created.projectId,
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
