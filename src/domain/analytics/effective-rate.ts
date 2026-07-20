import type { Prisma } from "@/generated/prisma/client"
import { decimalToNumber } from "@/lib/api"

type DecimalLike = Prisma.Decimal | number

export interface EffortTaskRow {
  clientId: string
  estimate: DecimalLike | null
  actualDays: DecimalLike | null
}

export interface ClientRevenueRow {
  clientId: string
  revenue: number
}

export interface ClientEffectiveRateRow {
  clientId: string
  revenue: number
  days: number
  effectiveRate: number | null
}

function toFiniteNumber(value: DecimalLike | null | undefined): number | null {
  const n = decimalToNumber(value)
  if (n == null || !Number.isFinite(n)) return null
  return n
}

/**
 * Resolve the effort, in days, attributable to a single task.
 *
 * Prefers the freelancer-entered `actualDays` over Linear's `estimate`. An
 * explicit `0` is a real measurement and wins over the estimate — only
 * `null`/`undefined`/non-finite values fall through.
 *
 * @param row - The task effort columns.
 * @returns The effort in days, or `null` when neither field carries a value.
 */
export function effortDaysForTask(
  row: Pick<EffortTaskRow, "estimate" | "actualDays">,
): number | null {
  const actual = toFiniteNumber(row.actualDays)
  if (actual !== null) return actual
  return toFiniteNumber(row.estimate)
}

/**
 * Sum the effort in days per client over the given tasks.
 *
 * @param rows - Period-scoped task rows.
 * @returns A map of clientId to total days; clients with no usable effort are absent.
 */
export function aggregateDaysByClient(
  rows: readonly EffortTaskRow[],
): Map<string, number> {
  const byClient = new Map<string, number>()
  for (const row of rows) {
    const days = effortDaysForTask(row)
    if (days === null) continue
    byClient.set(row.clientId, (byClient.get(row.clientId) ?? 0) + days)
  }
  return byClient
}

/**
 * Compute an effective daily rate from a revenue and an effort denominator.
 *
 * @param revenue - Revenue collected over the period.
 * @param days - Effort spent over the same period.
 * @returns The rounded rate, or `null` when the division is undefined
 *   (`days <= 0`, or non-finite inputs) so callers never render Infinity/NaN.
 */
export function computeEffectiveRate(
  revenue: number,
  days: number,
): number | null {
  if (!Number.isFinite(revenue) || !Number.isFinite(days)) return null
  if (days <= 0) return null
  const rate = revenue / days
  if (!Number.isFinite(rate)) return null
  return Math.round(rate)
}

/**
 * Attach the effort denominator and the effective daily rate to revenue rows.
 *
 * @param revenues - Revenue per client, already aggregated server-side.
 * @param tasks - Period-scoped task rows carrying the effort columns.
 * @returns One row per input revenue, in the same order, with `days` and
 *   `effectiveRate` (`null` when it cannot be derived).
 */
export function withEffectiveRates(
  revenues: readonly ClientRevenueRow[],
  tasks: readonly EffortTaskRow[],
): ClientEffectiveRateRow[] {
  const daysByClient = aggregateDaysByClient(tasks)
  return revenues.map((entry) => {
    const days = daysByClient.get(entry.clientId) ?? 0
    return {
      clientId: entry.clientId,
      revenue: entry.revenue,
      days,
      effectiveRate: computeEffectiveRate(entry.revenue, days),
    }
  })
}
