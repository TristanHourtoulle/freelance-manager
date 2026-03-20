import { z } from "zod/v4"

/** Supported P&L aggregation periods. */
export const FINANCIAL_PERIODS = ["month", "quarter", "year"] as const

export type FinancialPeriod = (typeof FINANCIAL_PERIODS)[number]

/** Validates query parameters for the financial P&L endpoint. */
export const financialQuerySchema = z.object({
  period: z.enum(FINANCIAL_PERIODS).default("month"),
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .default(new Date().getFullYear()),
})

export type FinancialQueryInput = z.infer<typeof financialQuerySchema>

/** Shape of a single P&L period in the response. */
export interface PeriodPnL {
  label: string
  revenue: number
  expenses: number
  profit: number
  margin: number
}

/** Shape of the financial projection. */
export interface FinancialProjection {
  nextPeriod: string
  estimatedRevenue: number
  estimatedExpenses: number
  estimatedProfit: number
}

/** Full response envelope for GET /api/financial. */
export interface FinancialResponse {
  periods: PeriodPnL[]
  totals: {
    revenue: number
    expenses: number
    profit: number
    margin: number
  }
  projection: FinancialProjection
}
