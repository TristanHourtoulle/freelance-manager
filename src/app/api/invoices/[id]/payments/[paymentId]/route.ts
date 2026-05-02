import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
} from "@/lib/api"
import { paymentUpdateSchema } from "@/lib/schemas/payment"
import { recomputeInvoicePayment, serializePayment } from "@/lib/payments"
import { deferActivityLog } from "@/lib/activity"

interface Params {
  params: Promise<{ id: string; paymentId: string }>
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id, paymentId } = await params

  try {
    const data = paymentUpdateSchema.parse(await req.json())

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, invoiceId: id, userId: user.id },
      select: { id: true },
    })
    if (!payment) return apiNotFound()

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          ...(data.amount != null ? { amount: data.amount } : {}),
          ...(data.paidAt ? { paidAt: new Date(data.paidAt) } : {}),
          ...(data.method !== undefined ? { method: data.method ?? null } : {}),
          ...(data.note !== undefined ? { note: data.note ?? null } : {}),
        },
      })
      await recomputeInvoicePayment(id, tx)
      return updated
    })

    return NextResponse.json(serializePayment(result))
  } catch (error) {
    return apiServerError(error)
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id, paymentId } = await params

  try {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, invoiceId: id, userId: user.id },
      select: {
        id: true,
        amount: true,
        invoice: { select: { number: true, clientId: true } },
      },
    })
    if (!payment) return apiNotFound()

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } })
      await recomputeInvoicePayment(id, tx)
    })

    deferActivityLog({
      userId: user.id,
      kind: "PAYMENT_DELETED",
      title: `Paiement de ${Number(payment.amount).toFixed(2)} € retiré sur ${payment.invoice.number}`,
      clientId: payment.invoice.clientId,
      invoiceId: id,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
