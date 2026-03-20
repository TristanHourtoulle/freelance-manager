import type { ActivityType } from "@/lib/schemas/tax-report"

/** URSSAF contribution rates for micro-entreprise (2024-2025). */
const URSSAF_RATES: Record<ActivityType, number> = {
  services: 0.211,
  sales: 0.123,
  mixed: 0.211, // Default to services rate for mixed; caller may split
}

/** ACRE discount: 50% reduction on URSSAF for the first year. */
const ACRE_DISCOUNT = 0.5

interface UrssafResult {
  /** Gross URSSAF amount before ACRE. */
  grossAmount: number
  /** ACRE discount amount (0 if not eligible). */
  acreDiscount: number
  /** Net URSSAF amount to pay. */
  netAmount: number
  /** Applied rate (before ACRE). */
  rate: number
}

/**
 * Calculates URSSAF contributions for a micro-entreprise.
 *
 * @param revenue - Total revenue for the period
 * @param activityType - Type of activity (services, sales, mixed)
 * @param acreEligible - Whether ACRE 50% reduction applies
 * @returns Breakdown of URSSAF contributions
 */
export function calculateUrssaf(
  revenue: number,
  activityType: ActivityType,
  acreEligible: boolean,
): UrssafResult {
  const rate = URSSAF_RATES[activityType]
  const grossAmount = round(revenue * rate)
  const acreDiscount = acreEligible ? round(grossAmount * ACRE_DISCOUNT) : 0
  const netAmount = round(grossAmount - acreDiscount)

  return { grossAmount, acreDiscount, netAmount, rate }
}

interface TvaResult {
  /** TVA amount collected. */
  tvaCollected: number
  /** Revenue excluding TVA (HT). */
  revenueHt: number
  /** Applied TVA rate. */
  rate: number
}

/**
 * Calculates TVA (VAT) for a given revenue amount.
 * Revenue is assumed to be TTC (tax inclusive) when tvaRate > 0.
 *
 * @param revenueTtc - Revenue including TVA
 * @param tvaRate - TVA rate as a decimal percentage (e.g. 20 for 20%)
 * @returns TVA breakdown
 */
export function calculateTva(revenueTtc: number, tvaRate: number): TvaResult {
  if (tvaRate <= 0) {
    return { tvaCollected: 0, revenueHt: revenueTtc, rate: 0 }
  }

  const rateDecimal = tvaRate / 100
  const revenueHt = round(revenueTtc / (1 + rateDecimal))
  const tvaCollected = round(revenueTtc - revenueHt)

  return { tvaCollected, revenueHt, rate: tvaRate }
}

interface NetIncomeResult {
  /** Gross revenue. */
  revenue: number
  /** Total deductible expenses. */
  expenses: number
  /** URSSAF contributions. */
  urssaf: number
  /** TVA to remit. */
  tva: number
  /** Net income after all deductions. */
  netIncome: number
}

/**
 * Calculates net income after all deductions.
 *
 * @param revenue - Gross revenue
 * @param expenses - Total expenses
 * @param urssaf - URSSAF contribution amount
 * @param tva - TVA amount to remit
 * @returns Net income breakdown
 */
export function calculateNetIncome(
  revenue: number,
  expenses: number,
  urssaf: number,
  tva: number,
): NetIncomeResult {
  const netIncome = round(revenue - expenses - urssaf - tva)
  return { revenue, expenses, urssaf, tva, netIncome }
}

/** Quarter label (Q1-Q4). */
type Quarter = "Q1" | "Q2" | "Q3" | "Q4"

interface MonthlyData {
  month: number
  revenue: number
  expenses: number
}

interface QuarterlyData {
  quarter: Quarter
  months: number[]
  revenue: number
  expenses: number
  urssaf: UrssafResult
  tva: TvaResult
  netIncome: NetIncomeResult
}

interface QuarterlyReport {
  year: number
  activityType: ActivityType
  acreEligible: boolean
  tvaRate: number
  quarters: QuarterlyData[]
  annual: {
    revenue: number
    expenses: number
    urssaf: UrssafResult
    tva: TvaResult
    netIncome: NetIncomeResult
  }
}

/**
 * Returns the quarter for a given month (1-12).
 */
function getQuarter(month: number): Quarter {
  if (month <= 3) return "Q1"
  if (month <= 6) return "Q2"
  if (month <= 9) return "Q3"
  return "Q4"
}

/**
 * Generates a quarterly P&L report with URSSAF and TVA calculations.
 *
 * @param data - Configuration and monthly breakdown
 * @returns Full quarterly report with annual totals
 */
export function generateQuarterlyReport(data: {
  year: number
  activityType: ActivityType
  acreEligible: boolean
  tvaRate: number
  monthlyData: MonthlyData[]
}): QuarterlyReport {
  const quarterMap = new Map<
    Quarter,
    { revenue: number; expenses: number; months: number[] }
  >()

  // Initialize quarters
  for (const q of ["Q1", "Q2", "Q3", "Q4"] as const) {
    quarterMap.set(q, { revenue: 0, expenses: 0, months: [] })
  }

  // Aggregate monthly data into quarters
  for (const entry of data.monthlyData) {
    const quarter = getQuarter(entry.month)
    const qData = quarterMap.get(quarter)!
    qData.revenue += entry.revenue
    qData.expenses += entry.expenses
    if (!qData.months.includes(entry.month)) {
      qData.months.push(entry.month)
    }
  }

  const quarters: QuarterlyData[] = (["Q1", "Q2", "Q3", "Q4"] as const).map(
    (quarter) => {
      const qData = quarterMap.get(quarter)!
      const revenue = round(qData.revenue)
      const expenses = round(qData.expenses)
      const urssaf = calculateUrssaf(
        revenue,
        data.activityType,
        data.acreEligible,
      )
      const tva = calculateTva(revenue, data.tvaRate)
      const netIncome = calculateNetIncome(
        revenue,
        expenses,
        urssaf.netAmount,
        tva.tvaCollected,
      )

      return {
        quarter,
        months: qData.months.sort((a, b) => a - b),
        revenue,
        expenses,
        urssaf,
        tva,
        netIncome,
      }
    },
  )

  // Annual totals
  const annualRevenue = round(quarters.reduce((sum, q) => sum + q.revenue, 0))
  const annualExpenses = round(quarters.reduce((sum, q) => sum + q.expenses, 0))
  const annualUrssaf = calculateUrssaf(
    annualRevenue,
    data.activityType,
    data.acreEligible,
  )
  const annualTva = calculateTva(annualRevenue, data.tvaRate)
  const annualNetIncome = calculateNetIncome(
    annualRevenue,
    annualExpenses,
    annualUrssaf.netAmount,
    annualTva.tvaCollected,
  )

  return {
    year: data.year,
    activityType: data.activityType,
    acreEligible: data.acreEligible,
    tvaRate: data.tvaRate,
    quarters,
    annual: {
      revenue: annualRevenue,
      expenses: annualExpenses,
      urssaf: annualUrssaf,
      tva: annualTva,
      netIncome: annualNetIncome,
    },
  }
}

/** Round to 2 decimal places. */
function round(value: number): number {
  return Math.round(value * 100) / 100
}
