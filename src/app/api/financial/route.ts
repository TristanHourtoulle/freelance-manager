import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import {
  financialQuerySchema,
  type FinancialPeriod,
  type PeriodPnL,
  type FinancialProjection,
} from "@/lib/schemas/financial"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

/**
 * Returns the period label for a given date.
 *
 * - month:   "2026-01"
 * - quarter: "Q1 2026"
 * - year:    "2026"
 */
function getPeriodLabel(date: Date, period: FinancialPeriod): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1

  switch (period) {
    case "month":
      return `${y}-${String(m).padStart(2, "0")}`
    case "quarter":
      return `Q${Math.ceil(m / 3)} ${y}`
    case "year":
      return String(y)
  }
}

/**
 * Generates all expected period labels for the given year and granularity.
 */
function generatePeriodLabels(year: number, period: FinancialPeriod): string[] {
  switch (period) {
    case "month":
      return Array.from(
        { length: 12 },
        (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
      )
    case "quarter":
      return Array.from({ length: 4 }, (_, i) => `Q${i + 1} ${year}`)
    case "year":
      return [String(year)]
  }
}

/**
 * Computes the next period label for projection.
 */
function getNextPeriodLabel(year: number, period: FinancialPeriod): string {
  switch (period) {
    case "month": {
      const now = new Date()
      const nextMonth = now.getMonth() + 2 // +1 for 0-index, +1 for next
      if (nextMonth > 12) return `${year + 1}-01`
      return `${year}-${String(nextMonth).padStart(2, "0")}`
    }
    case "quarter": {
      const now = new Date()
      const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)
      if (currentQuarter >= 4) return `Q1 ${year + 1}`
      return `Q${currentQuarter + 1} ${year}`
    }
    case "year":
      return String(year + 1)
  }
}

/**
 * GET /api/financial
 * Computes Profit & Loss data grouped by the requested period.
 * Revenue comes from paid invoices, expenses from the expense table.
 *
 * @query period - "month" | "quarter" | "year" (default: "month")
 * @query year   - Fiscal year to report on (default: current year)
 * @returns 200 - `{ periods, totals, projection }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid query parameters
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

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const { period, year } = financialQuerySchema.parse(params)

    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year + 1, 0, 1)

    // Fetch paid invoices and expenses for the year in parallel
    const [paidInvoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          status: "PAID",
          month: { gte: yearStart, lt: yearEnd },
          client: { userId: userOrError.id },
        },
        select: { totalAmount: true, month: true },
      }),
      prisma.expense.findMany({
        where: {
          userId: userOrError.id,
          deletedAt: null,
          date: { gte: yearStart, lt: yearEnd },
        },
        select: { amount: true, date: true },
      }),
    ])

    // Aggregate revenue by period
    const revenueByPeriod = new Map<string, number>()
    for (const invoice of paidInvoices) {
      const label = getPeriodLabel(invoice.month, period)
      const current = revenueByPeriod.get(label) ?? 0
      revenueByPeriod.set(label, current + Number(invoice.totalAmount))
    }

    // Aggregate expenses by period
    const expensesByPeriod = new Map<string, number>()
    for (const expense of expenses) {
      const label = getPeriodLabel(expense.date, period)
      const current = expensesByPeriod.get(label) ?? 0
      expensesByPeriod.set(label, current + Number(expense.amount))
    }

    // Build period rows for every expected slot
    const labels = generatePeriodLabels(year, period)
    const periods: PeriodPnL[] = labels.map((label) => {
      const revenue = Math.round((revenueByPeriod.get(label) ?? 0) * 100) / 100
      const exp = Math.round((expensesByPeriod.get(label) ?? 0) * 100) / 100
      const profit = Math.round((revenue - exp) * 100) / 100
      const margin =
        revenue > 0 ? Math.round((profit / revenue) * 10000) / 100 : 0

      return { label, revenue, expenses: exp, profit, margin }
    })

    // Compute totals
    const totalRevenue = periods.reduce((sum, p) => sum + p.revenue, 0)
    const totalExpenses = periods.reduce((sum, p) => sum + p.expenses, 0)
    const totalProfit = Math.round((totalRevenue - totalExpenses) * 100) / 100
    const totalMargin =
      totalRevenue > 0
        ? Math.round((totalProfit / totalRevenue) * 10000) / 100
        : 0

    // Projection based on last 3 non-zero periods
    const nonZeroPeriods = periods.filter(
      (p) => p.revenue > 0 || p.expenses > 0,
    )
    const recentPeriods = nonZeroPeriods.slice(-3)

    let projection: FinancialProjection
    if (recentPeriods.length === 0) {
      projection = {
        nextPeriod: getNextPeriodLabel(year, period),
        estimatedRevenue: 0,
        estimatedExpenses: 0,
        estimatedProfit: 0,
      }
    } else {
      const count = recentPeriods.length
      const avgRevenue =
        Math.round(
          (recentPeriods.reduce((s, p) => s + p.revenue, 0) / count) * 100,
        ) / 100
      const avgExpenses =
        Math.round(
          (recentPeriods.reduce((s, p) => s + p.expenses, 0) / count) * 100,
        ) / 100

      projection = {
        nextPeriod: getNextPeriodLabel(year, period),
        estimatedRevenue: avgRevenue,
        estimatedExpenses: avgExpenses,
        estimatedProfit: Math.round((avgRevenue - avgExpenses) * 100) / 100,
      }
    }

    return NextResponse.json({
      periods,
      totals: {
        revenue: Math.round(totalRevenue * 100) / 100,
        expenses: Math.round(totalExpenses * 100) / 100,
        profit: totalProfit,
        margin: totalMargin,
      },
      projection,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
