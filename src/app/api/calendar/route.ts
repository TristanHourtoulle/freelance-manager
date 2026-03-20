import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

interface CalendarDeadline {
  id: string
  type: "INVOICE_DUE" | "RECURRING_EXPENSE"
  title: string
  date: string
  clientName: string
  clientId: string
  metadata: {
    invoiceId?: string
    expenseId?: string
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
    const rl = rateLimit(request)
    if (!rl.success) {
      return NextResponse.json(
        {
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.reset / 1000)) },
        },
      )
    }

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

    const invoiceDeadlines: CalendarDeadline[] = invoices
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

    // Fetch recurring expenses and project next occurrence
    const recurringExpenses = await prisma.expense.findMany({
      where: {
        userId: userOrError.id,
        recurring: true,
        deletedAt: null,
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    })

    const recurringDeadlines: CalendarDeadline[] = []
    for (const expense of recurringExpenses) {
      const recurringDay = expense.date.getDate()
      let nextDate = new Date(now.getFullYear(), now.getMonth(), recurringDay)

      // If the day already passed this month, project to next month
      if (nextDate < now) {
        nextDate = new Date(now.getFullYear(), now.getMonth() + 1, recurringDay)
      }

      // Only include if within the time window
      if (nextDate < pastBound || nextDate > futureBound) continue

      recurringDeadlines.push({
        id: `recurring-expense-${expense.id}`,
        type: "RECURRING_EXPENSE",
        title: `Recurring expense - ${expense.description}`,
        date: nextDate.toISOString(),
        clientName: expense.client?.name ?? "",
        clientId: expense.client?.id ?? "",
        metadata: {
          expenseId: expense.id,
          amount: Number(expense.amount),
          status: "RECURRING",
        },
      })
    }

    const deadlines = [...invoiceDeadlines, ...recurringDeadlines].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    return NextResponse.json({ deadlines })
  } catch (error) {
    return handleApiError(error)
  }
}
