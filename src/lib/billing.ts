import type { BillingMode } from "@/generated/prisma/client"

/** Input parameters for billing calculation. */
interface BillingInput {
  billingMode: BillingMode
  rate: number
  estimate: number | undefined
  rateOverride?: number | null
}

/** Result of a billing calculation with the computed amount and a human-readable formula. */
interface BillingResult {
  amount: number
  formula: string
}

const HOURS_PER_DAY = 8

/**
 * Calculates the billing amount for a task based on billing mode, rate, and estimate.
 * Supports HOURLY, DAILY, FIXED, and FREE modes.
 *
 * @param input - Billing parameters (mode, rate, estimate, optional rate override)
 * @returns The computed amount (rounded to 2 decimals) and a human-readable formula
 *
 * @example
 * ```ts
 * calculateBilling({ billingMode: "HOURLY", rate: 100, estimate: 5 })
 * // => { amount: 500, formula: "5h x 100 EUR/h" }
 * ```
 */
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

/**
 * Sums the billing amounts of all tasks marked for invoicing within a group.
 *
 * @param tasks - Array of tasks with billingAmount and toInvoice flag
 * @returns Total amount for tasks where `toInvoice` is true
 */
export function calculateGroupTotal(
  tasks: ReadonlyArray<{ billingAmount: number; toInvoice: boolean }>,
): number {
  return tasks
    .filter((t) => t.toInvoice)
    .reduce((sum, t) => sum + t.billingAmount, 0)
}

/**
 * Returns the fixed project rate if the group has any tasks marked for invoicing.
 *
 * @param rate - The client's fixed project rate
 * @param hasToInvoiceTasks - Whether at least one task is marked for invoicing
 * @returns The rate if there are tasks to invoice, otherwise 0
 */
export function calculateFixedGroupTotal(
  rate: number,
  hasToInvoiceTasks: boolean,
): number {
  return hasToInvoiceTasks ? rate : 0
}
