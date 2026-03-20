import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"

interface CalendarDeadline {
  id: string
  type: "INVOICE_DUE"
  title: string
  date: string
  clientName: string
  clientId: string
  metadata: {
    invoiceId: string
    amount: number
    status: string
  }
}

/**
 * GET /api/calendar
 * Returns upcoming deadlines aggregated from invoices with payment due dates.
 * Includes the past 7 days and next 90 days.
 * @returns 200 - `{ deadlines: CalendarDeadline[] }`
 * @throws 401 - Unauthenticated request
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const now = new Date()
    const pastBound = new Date(now)
    pastBound.setDate(pastBound.getDate() - 7)
    const futureBound = new Date(now)
    futureBound.setDate(futureBound.getDate() + 90)

    const invoices = await prisma.invoice.findMany({
      where: {
        client: {
          userId: userOrError.id,
        },
        paymentDueDate: {
          gte: pastBound,
          lte: futureBound,
        },
        NOT: { status: "PAID" },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { paymentDueDate: "asc" },
    })

    const deadlines: CalendarDeadline[] = invoices
      .filter((inv) => inv.paymentDueDate !== null)
      .map((inv) => ({
        id: `invoice-${inv.id}`,
        type: "INVOICE_DUE" as const,
        title: `Invoice due - ${inv.client.name}`,
        date: inv.paymentDueDate!.toISOString(),
        clientName: inv.client.name,
        clientId: inv.client.id,
        metadata: {
          invoiceId: inv.id,
          amount: Number(inv.totalAmount),
          status: inv.status,
        },
      }))

    return NextResponse.json({ deadlines })
  } catch (error) {
    return handleApiError(error)
  }
}
