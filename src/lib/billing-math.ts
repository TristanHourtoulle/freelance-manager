// Pricing formulas — kept as a tiny, well-tested module so the rest of the app
// never has to think about hours-vs-days conversions.

import type { BillingMode } from "@/generated/prisma/client"

/**
 * Build the (qty, rate) pair for an invoice line generated from a task.
 *
 * - DAILY:  qty = task.estimate (days),         rate = client.rate (€/day)
 * - HOURLY: qty = task.estimate * 8 (hours),    rate = client.rate (€/hour)
 * - FIXED:  qty = 1, rate = 0 (filled manually for milestones / deposits)
 */
export function lineFromTask(opts: {
  billingMode: BillingMode
  rate: number
  estimateDays: number | null | undefined
}): { qty: number; rate: number } {
  const est = opts.estimateDays ?? 1
  if (opts.billingMode === "DAILY") return { qty: est, rate: opts.rate }
  if (opts.billingMode === "HOURLY") return { qty: est * 8, rate: opts.rate }
  return { qty: 1, rate: 0 }
}

/**
 * Pipeline value of an unbilled task = the amount the task would generate if
 * invoiced today. Returns 0 for FIXED clients (their pipeline is the milestone,
 * not the per-task valuation).
 */
export function pipelineValueForTask(opts: {
  billingMode: BillingMode
  rate: number
  estimateDays: number | null | undefined
}): number {
  if (opts.billingMode === "FIXED") return 0
  const { qty, rate } = lineFromTask(opts)
  return qty * rate
}

export function sumLines(lines: { qty: number; rate: number }[]): number {
  return lines.reduce((s, l) => s + l.qty * l.rate, 0)
}
