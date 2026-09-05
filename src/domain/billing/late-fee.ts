import type { InvoiceDocStatus } from "./types"

const DAY_MS = 86_400_000

export interface LateFeeInput {
  total: number
  dueDate: Date
  status: InvoiceDocStatus
  payments: ReadonlyArray<{ amount: number; paidAt: Date }>
  fixedAmount: number
  annualRate: number
  asOf: Date
}

export interface LateFeeSegment {
  from: Date
  to: Date
  days: number
  outstanding: number
  interest: number
}

export interface LateFeeBreakdown {
  daysLate: number
  fixed: number
  interest: number
  total: number
  segments: ReadonlyArray<LateFeeSegment>
}

function wholeDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function sumPaidThrough(
  payments: ReadonlyArray<{ amount: number; paidAt: Date }>,
  cutoff: Date,
): number {
  return payments.reduce(
    (sum, payment) =>
      payment.paidAt.getTime() <= cutoff.getTime() ? sum + payment.amount : sum,
    0,
  )
}

function zeroBreakdown(): LateFeeBreakdown {
  return { daysLate: 0, fixed: 0, interest: 0, total: 0, segments: [] }
}

function buildBoundaries(
  dueDate: Date,
  asOf: Date,
  payments: ReadonlyArray<{ amount: number; paidAt: Date }>,
): Date[] {
  const latePayments = payments
    .filter((payment) => payment.paidAt.getTime() > dueDate.getTime())
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime())

  const boundaries: Date[] = [dueDate]
  for (const payment of latePayments) {
    const last = boundaries[boundaries.length - 1] as Date
    if (payment.paidAt.getTime() > last.getTime()) {
      boundaries.push(payment.paidAt)
    }
  }

  const last = boundaries[boundaries.length - 1] as Date
  if (asOf.getTime() > last.getTime()) {
    boundaries.push(asOf)
  }

  return boundaries
}

/**
 * Compute a late-payment penalty breakdown for one invoice.
 *
 * Daily interest accrues on the outstanding balance between the due date
 * and the earlier of `asOf` and the moment the balance reaches zero: once a
 * segment's outstanding balance drops to zero or below, accrual stops
 * permanently — a later payment never restarts it. The flat `fixedAmount`
 * applies once, as soon as the invoice is at least one day late, never per
 * segment. Only the final `interest`, `fixed` and `total` are rounded to
 * cents; segment interest and the running total stay unrounded so the sum
 * does not drift from rounding each segment independently.
 *
 * @param input - The invoice total, due date, status, payment history,
 *   the late-fee policy (`fixedAmount`, `annualRate`), and the reference
 *   instant `asOf`.
 * @returns The number of whole days late, the flat fee, the accrued
 *   interest, their rounded sum, and the per-period accrual segments.
 */
export function computeLateFee(input: LateFeeInput): LateFeeBreakdown {
  const { total, dueDate, status, payments, fixedAmount, annualRate, asOf } = input

  if (status !== "SENT" || asOf.getTime() <= dueDate.getTime()) {
    return zeroBreakdown()
  }

  const boundaries = buildBoundaries(dueDate, asOf, payments)

  const segments: LateFeeSegment[] = []
  let stopDate: Date | null = null

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const from = boundaries[i] as Date
    const to = boundaries[i + 1] as Date
    const outstanding = total - sumPaidThrough(payments, from)

    if (outstanding <= 0) {
      stopDate = from
      break
    }

    const days = wholeDays(from, to)
    const interest = (outstanding * annualRate * days) / 365
    segments.push({ from, to, days, outstanding, interest })
  }

  const daysLate = wholeDays(dueDate, stopDate ?? asOf)
  const rawInterest = segments.reduce((sum, segment) => sum + segment.interest, 0)
  const rawFixed = daysLate > 0 ? fixedAmount : 0

  return {
    daysLate,
    fixed: round2(rawFixed),
    interest: round2(rawInterest),
    total: round2(rawInterest + rawFixed),
    segments,
  }
}
