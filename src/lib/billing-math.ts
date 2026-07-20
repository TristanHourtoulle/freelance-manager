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

export function sumLines(
  lines: readonly { qty: number; rate: number }[],
): number {
  return lines.reduce((s, l) => s + l.qty * l.rate, 0)
}

/**
 * Split a monetary amount into `parts` installments that sum back exactly.
 *
 * The arithmetic runs in integer cents to avoid float drift. The remaining
 * cents are handed out one per installment starting from the first one, so
 * the earliest installments are the (at most one cent) heavier ones. Works
 * for negative totals too, since the floor-based remainder stays in
 * `[0, parts)`.
 *
 * @param total - Amount to split, in euros.
 * @param parts - Number of installments, an integer >= 1.
 * @returns The installment amounts in euros, in order, summing to `total`
 *   rounded to the cent.
 * @throws RangeError when `parts` is not an integer >= 1, or when `total` is
 *   not finite.
 */
export function allocateSplitAmounts(total: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new RangeError("parts must be an integer greater than or equal to 1")
  }
  if (!Number.isFinite(total)) {
    throw new RangeError("total must be a finite number")
  }
  const totalCents = Math.round(total * 100)
  const baseCents = Math.floor(totalCents / parts)
  const remainder = totalCents - baseCents * parts
  const amounts: number[] = []
  for (let i = 0; i < parts; i++) {
    amounts.push((baseCents + (i < remainder ? 1 : 0)) / 100)
  }
  return amounts
}
