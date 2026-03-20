import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/clients/:id/dashboard
 * Returns aggregated dashboard data for a single client:
 * client info, revenue by month, recent invoices, task stats,
 * total revenue, and recent expenses.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const client = await prisma.client.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!client) {
      return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    }

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const [invoices, taskOverrides, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: { clientId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.taskOverride.findMany({
        where: { clientId: id },
      }),
      prisma.expense.findMany({
        where: { clientId: id, userId: userOrError.id },
        orderBy: { date: "desc" },
        take: 5,
      }),
    ])

    const totalRevenue = invoices.reduce(
      (sum, inv) => sum + Number(inv.totalAmount),
      0,
    )

    const recentInvoices = invoices.slice(0, 5).map((inv) => ({
      id: inv.id,
      month: inv.month.toISOString(),
      totalAmount: Number(inv.totalAmount),
      status: inv.status,
      paymentDueDate: inv.paymentDueDate?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
    }))

    const revenueByMonth = buildRevenueByMonth(invoices, sixMonthsAgo)

    const totalTasks = taskOverrides.length
    const invoicedTasks = taskOverrides.filter((t) => t.invoiced).length
    const pendingTasks = totalTasks - invoicedTasks

    const recentExpenses = expenses.map((exp) => ({
      id: exp.id,
      description: exp.description,
      amount: Number(exp.amount),
      date: exp.date.toISOString(),
      category: exp.category,
    }))

    const totalExpenses = expenses.length

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        company: client.company,
        category: client.category,
        billingMode: client.billingMode,
        rate: Number(client.rate),
        createdAt: client.createdAt.toISOString(),
        logo: client.logo,
      },
      stats: {
        totalRevenue,
        totalInvoices: invoices.length,
        totalTasks,
        invoicedTasks,
        pendingTasks,
        totalExpenses,
      },
      revenueByMonth,
      recentInvoices,
      recentExpenses,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

interface InvoiceRow {
  month: Date
  totalAmount: { toString(): string } | number
}

function buildRevenueByMonth(
  invoices: InvoiceRow[],
  since: Date,
): { month: string; label: string; amount: number }[] {
  const monthMap = new Map<string, number>()

  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthMap.set(key, 0)
  }

  for (const inv of invoices) {
    const d = new Date(inv.month)
    if (d < since) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) ?? 0) + Number(inv.totalAmount))
    }
  }

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]

  return Array.from(monthMap.entries()).map(([key, amount]) => {
    const [, monthStr] = key.split("-")
    const monthIndex = parseInt(monthStr as string, 10) - 1
    return {
      month: key,
      label: monthNames[monthIndex] ?? key,
      amount,
    }
  })
}
