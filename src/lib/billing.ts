import type { BillingMode } from "@/generated/prisma/client"

interface BillingInput {
  billingMode: BillingMode
  rate: number
  estimate: number | undefined
  rateOverride?: number | null
}

interface BillingResult {
  amount: number
  formula: string
}

const HOURS_PER_DAY = 8

export function calculateBilling(input: BillingInput): BillingResult {
  const { billingMode, estimate, rateOverride } = input
  const rate = rateOverride ?? input.rate

  if (billingMode === "FREE") {
    return { amount: 0, formula: "Free" }
  }

  if (billingMode === "FIXED") {
    return { amount: 0, formula: "Fixed project rate" }
  }

  if (estimate === undefined || estimate === 0) {
    return { amount: 0, formula: "No estimate" }
  }

  if (billingMode === "HOURLY") {
    const amount = estimate * rate
    return {
      amount: Math.round(amount * 100) / 100,
      formula: `${estimate}h x ${rate} EUR/h`,
    }
  }

  // DAILY
  const days = estimate / HOURS_PER_DAY
  const amount = days * rate
  return {
    amount: Math.round(amount * 100) / 100,
    formula: `${days.toFixed(2)}d x ${rate} EUR/d`,
  }
}

export function calculateGroupTotal(
  tasks: ReadonlyArray<{ billingAmount: number; toInvoice: boolean }>,
): number {
  return tasks
    .filter((t) => t.toInvoice)
    .reduce((sum, t) => sum + t.billingAmount, 0)
}

export function calculateFixedGroupTotal(
  rate: number,
  hasToInvoiceTasks: boolean,
): number {
  return hasToInvoiceTasks ? rate : 0
}
