import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
} from "@/lib/api"
import { paymentCreateSchema } from "@/lib/schemas/payment"
import { recomputeInvoicePayment, serializePayment } from "@/lib/payments"
import { deferActivityLog } from "@/lib/activity"

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params

  try {
    const [user, body, invoice] = await Promise.all([
      getAuthUser(),
      req.json(),
      prisma.invoice.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          number: true,
          clientId: true,
          userId: true,
        },
      }),
    ])
    if (!user) return apiUnauthorized()
    if (!invoice || invoice.userId !== user.id) return apiNotFound()
    const data = paymentCreateSchema.parse(body)
    if (invoice.status === "CANCELLED") {
      return NextResponse.json(
        {
          error: "Impossible d'enregistrer un paiement sur une facture annulée",
        },
        { status: 409 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId: user.id,
          invoiceId: id,
          amount: data.amount,
          paidAt: new Date(data.paidAt),
          method: data.method ?? null,
          note: data.note ?? null,
        },
      })
      await recomputeInvoicePayment(id, tx)
      return payment
    })

    deferActivityLog({
      userId: user.id,
      kind: "PAYMENT_RECORDED",
      title: `Paiement de ${data.amount.toFixed(2)} € sur ${invoice.number}`,
      meta: data.method ?? undefined,
      clientId: invoice.clientId,
      invoiceId: invoice.id,
    })

    return NextResponse.json(serializePayment(result), { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
