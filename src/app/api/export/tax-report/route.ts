import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { taxReportQuerySchema } from "@/lib/schemas/tax-report"
import {
  generateQuarterlyReport,
  calculateUrssaf,
  calculateTva,
} from "@/lib/tax-calculator"
import { NextResponse } from "next/server"

/**
 * GET /api/export/tax-report
 * Generates a tax report for a given year.
 * Query params: year (required), regime, activityType, format (csv|json)
 * @returns JSON report or downloadable CSV file
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const query = taxReportQuerySchema.parse(params)

    const yearStart = new Date(`${query.year}-01-01T00:00:00.000Z`)
    const yearEnd = new Date(`${query.year}-12-31T23:59:59.999Z`)

    // Fetch user settings for tax config
    const settings = await prisma.userSettings.findUnique({
      where: { userId: userOrError.id },
    })

    const tvaRate = settings ? Number(settings.tvaRate) : 0
    const acreEligible = settings?.acreEligible ?? false

    // Fetch invoices (revenue) and expenses for the year in parallel
    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          client: { userId: userOrError.id },
          status: "PAID",
          month: { gte: yearStart, lte: yearEnd },
        },
        select: { month: true, totalAmount: true },
      }),
      prisma.expense.findMany({
        where: {
          userId: userOrError.id,
          date: { gte: yearStart, lte: yearEnd },
        },
        select: { date: true, amount: true },
      }),
    ])

    // Aggregate by month
    const monthlyMap = new Map<number, { revenue: number; expenses: number }>()

    for (let m = 1; m <= 12; m++) {
      monthlyMap.set(m, { revenue: 0, expenses: 0 })
    }

    for (const inv of invoices) {
      const month = inv.month.getMonth() + 1
      const entry = monthlyMap.get(month)!
      entry.revenue += Number(inv.totalAmount)
    }

    for (const exp of expenses) {
      const month = exp.date.getMonth() + 1
      const entry = monthlyMap.get(month)!
      entry.expenses += Number(exp.amount)
    }

    const monthlyData = Array.from(monthlyMap.entries()).map(
      ([month, data]) => ({
        month,
        revenue: data.revenue,
        expenses: data.expenses,
      }),
    )

    const report = generateQuarterlyReport({
      year: query.year,
      activityType: query.activityType,
      acreEligible,
      tvaRate,
      monthlyData,
    })

    // Return JSON or CSV
    if (query.format === "csv") {
      const csv = generateCsv(report)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="tax-report-${query.year}.csv"`,
        },
      })
    }

    return NextResponse.json(report)
  } catch (error) {
    return handleApiError(error)
  }
}

/** Generates a CSV string from the quarterly report. */
function generateCsv(
  report: ReturnType<typeof generateQuarterlyReport>,
): string {
  const rows: string[] = []

  // Header
  rows.push(
    [
      "Period",
      "Revenue",
      "Expenses",
      "URSSAF Gross",
      "ACRE Discount",
      "URSSAF Net",
      "TVA Collected",
      "Net Income",
    ].join(","),
  )

  // Quarterly rows
  for (const q of report.quarters) {
    rows.push(
      [
        q.quarter,
        q.revenue.toFixed(2),
        q.expenses.toFixed(2),
        q.urssaf.grossAmount.toFixed(2),
        q.urssaf.acreDiscount.toFixed(2),
        q.urssaf.netAmount.toFixed(2),
        q.tva.tvaCollected.toFixed(2),
        q.netIncome.netIncome.toFixed(2),
      ].join(","),
    )
  }

  // Annual total
  const a = report.annual
  rows.push(
    [
      "Annual",
      a.revenue.toFixed(2),
      a.expenses.toFixed(2),
      a.urssaf.grossAmount.toFixed(2),
      a.urssaf.acreDiscount.toFixed(2),
      a.urssaf.netAmount.toFixed(2),
      a.tva.tvaCollected.toFixed(2),
      a.netIncome.netIncome.toFixed(2),
    ].join(","),
  )

  return rows.join("\n")
}
