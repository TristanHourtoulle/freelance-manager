import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { getInvoiceComputed } from "@/lib/payments"
import { relanceTitle } from "@/domain/billing/relance"
import { ACTION_INCLUDE, serializeAction } from "@/lib/data/actions"

interface Params {
  params: Promise<{ id: string }>
}

/**
 * Queue (or return) the RELANCE follow-up action of an overdue invoice.
 *
 * Idempotent by construction: the nullable UNIQUE `relanceInvoiceId` column
 * lets the database arbitrate, so a racing second call loses with `P2002`
 * and is answered with the winner's row instead of an error. The column is
 * never cleared, so an invoice yields at most one auto-relance ever — even
 * after the action is marked DONE. Further relances go through the manual
 * action modal.
 *
 * A settled invoice (`balanceDue <= 0`, recomputed from the payment rows and
 * never read off the cached `paymentStatus`) is not an error: the response is
 * a 200 carrying `settled: true` so the client can show a neutral notice
 * rather than an error toast.
 *
 * @returns 200 `{ action, created, settled }`, 401, 403 or 404.
 */
export async function POST(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const { id } = await params

  try {
    const user = await getAuthUser()
    if (!user) return apiUnauthorized()

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        clientId: true,
        number: true,
        status: true,
        paymentStatus: true,
        total: true,
        dueDate: true,
        payments: { select: { amount: true, paidAt: true } },
      },
    })
    if (!invoice || invoice.userId !== user.id) return apiNotFound()

    const existing = await prisma.clientAction.findUnique({
      where: { relanceInvoiceId: invoice.id },
      include: ACTION_INCLUDE,
    })
    if (existing) {
      return NextResponse.json({
        action: serializeAction(existing),
        created: false,
        settled: false,
      })
    }

    const { balanceDue } = getInvoiceComputed(invoice)
    if (balanceDue <= 0) {
      return NextResponse.json({ action: null, created: false, settled: true })
    }

    try {
      const created = await prisma.clientAction.create({
        data: {
          userId: user.id,
          clientId: invoice.clientId,
          type: "RELANCE",
          title: relanceTitle(invoice.number),
          dueDate: new Date(),
          invoiceId: invoice.id,
          relanceInvoiceId: invoice.id,
        },
        include: ACTION_INCLUDE,
      })
      return NextResponse.json({
        action: serializeAction(created),
        created: true,
        settled: false,
      })
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const winner = await prisma.clientAction.findUniqueOrThrow({
          where: { relanceInvoiceId: invoice.id },
          include: ACTION_INCLUDE,
        })
        return NextResponse.json({
          action: serializeAction(winner),
          created: false,
          settled: false,
        })
      }
      throw err
    }
  } catch (error) {
    return apiServerError(error)
  }
}
