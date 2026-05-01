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

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const data = paymentCreateSchema.parse(await req.json())

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true },
    })
    if (!invoice) return apiNotFound()
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

    return NextResponse.json(serializePayment(result), { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
