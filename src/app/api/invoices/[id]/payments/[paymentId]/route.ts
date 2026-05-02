import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { paymentUpdateSchema } from "@/lib/schemas/payment"
import { recomputeInvoicePayment, serializePayment } from "@/lib/payments"
import { deferActivityLog } from "@/lib/activity"

interface Params {
  params: Promise<{ id: string; paymentId: string }>
}

export async function PATCH(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const { id, paymentId } = await params

  try {
    const [user, body, payment] = await Promise.all([
      getAuthUser(),
      req.json(),
      prisma.payment.findUnique({
        where: { id: paymentId },
        select: { id: true, invoiceId: true, userId: true },
      }),
    ])
    if (!user) return apiUnauthorized()
    if (!payment || payment.userId !== user.id || payment.invoiceId !== id) {
      return apiNotFound()
    }
    const data = paymentUpdateSchema.parse(body)

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

export async function DELETE(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const { id, paymentId } = await params

  try {
    const [user, payment] = await Promise.all([
      getAuthUser(),
      prisma.payment.findUnique({
        where: { id: paymentId },
        select: {
          id: true,
          amount: true,
          invoiceId: true,
          userId: true,
          invoice: { select: { number: true, clientId: true } },
        },
      }),
    ])
    if (!user) return apiUnauthorized()
    if (!payment || payment.userId !== user.id || payment.invoiceId !== id) {
      return apiNotFound()
    }

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
