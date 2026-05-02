import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import {
  invoiceStatusUpdateSchema,
  invoiceUpdateSchema,
} from "@/lib/schemas/invoice"
import {
  getInvoiceComputed,
  recomputeInvoicePayment,
  serializePayment,
} from "@/lib/payments"
import { deferActivityLog } from "@/lib/activity"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const inv = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
      include: {
        lines: { orderBy: { position: "asc" } },
        client: true,
        payments: { orderBy: { paidAt: "asc" } },
      },
    })
    if (!inv) return apiNotFound()
    const computed = getInvoiceComputed(inv)
    return NextResponse.json({
      id: inv.id,
      number: inv.number,
      clientId: inv.clientId,
      projectId: inv.projectId,
      client: {
        id: inv.client.id,
        firstName: inv.client.firstName,
        lastName: inv.client.lastName,
        company: inv.client.company,
        email: inv.client.email,
        billingMode: inv.client.billingMode,
        color: inv.client.color,
      },
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
      lines: inv.lines.map((l) => ({
        id: l.id,
        taskId: l.taskId,
        label: l.label,
        qty: decimalToNumber(l.qty) ?? 0,
        rate: decimalToNumber(l.rate) ?? 0,
      })),
      payments: inv.payments.map(serializePayment),
    })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const body = (await req.json()) as Record<string, unknown>
    const isFullUpdate = Array.isArray(body.lines)

    const owned = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
      select: { id: true, number: true, clientId: true, status: true },
    })
    if (!owned) return apiNotFound()

    if (!isFullUpdate) {
      const data = invoiceStatusUpdateSchema.parse(body)
      await prisma.invoice.update({
        where: { id },
        data: { status: data.status },
      })
      if (data.status !== owned.status) {
        deferActivityLog({
          userId: user.id,
          kind:
            data.status === "SENT"
              ? "INVOICE_SENT"
              : data.status === "CANCELLED"
                ? "INVOICE_CANCELLED"
                : "INVOICE_CREATED",
          title:
            data.status === "SENT"
              ? `Facture ${owned.number} émise`
              : data.status === "CANCELLED"
                ? `Facture ${owned.number} annulée`
                : `Facture ${owned.number} repassée en brouillon`,
          clientId: owned.clientId,
          invoiceId: owned.id,
        })
      }
      return NextResponse.json({ ok: true })
    }

    const data = invoiceUpdateSchema.parse(body)

    if (data.number) {
      const conflict = await prisma.invoice.findFirst({
        where: {
          userId: user.id,
          number: data.number.trim(),
          NOT: { id },
        },
        select: { id: true },
      })
      if (conflict) {
        return NextResponse.json(
          { error: `Le numéro de facture "${data.number}" est déjà utilisé` },
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

    await prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { invoiceId: id, userId: user.id },
        data: { invoiceId: null, status: "PENDING_INVOICE" },
      })

      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } })

      await tx.invoice.update({
        where: { id },
        data: {
          projectId: data.projectId ?? null,
          ...(data.number ? { number: data.number.trim() } : {}),
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
          where: { id: { in: data.taskIds }, userId: user.id },
          data: { invoiceId: id, status: "DONE" },
        })
      }

      await recomputeInvoicePayment(id, tx)
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    await prisma.$transaction([
      prisma.task.updateMany({
        where: { invoiceId: id, userId: user.id },
        data: { invoiceId: null, status: "PENDING_INVOICE" },
      }),
      prisma.invoice.deleteMany({ where: { id, userId: user.id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
