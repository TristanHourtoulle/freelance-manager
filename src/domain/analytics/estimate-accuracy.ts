import type { Prisma } from "@/generated/prisma/client"
import { decimalToNumber } from "@/lib/api"

type DecimalLike = Prisma.Decimal | number

export const ESTIMATE_ACCURACY_MIN_SAMPLE = 5

/**
 * The two effort columns of a task, plus the client it belongs to.
 */
export interface AccuracyTaskRow {
  clientId: string
  estimate: DecimalLike | null
  actualDays: DecimalLike | null
}

/**
 * Estimate-vs-actual verdict for a set of tasks.
 *
 * `ratio` above 1 means the work overran its estimate. `n` and `coverage`
 * travel with it on purpose: `actualDays` is newly populated, so coverage is
 * expected to be thin for months and a ratio computed over a handful of tasks
 * misleads. Callers must gate the display on `reliable`.
 */
export interface AccuracyResult {
  ratio: number | null
  n: number
  coverage: number | null
  sumEstimate: number
  sumActual: number
  reliable: boolean
}

function toFiniteNumber(value: DecimalLike | null | undefined): number | null {
  const n = decimalToNumber(value)
  if (n == null || !Number.isFinite(n)) return null
  return n
}

/**
 * Measure how far actual effort drifts from the original estimate.
 *
 * Only rows carrying **both** a positive finite `estimate` and a finite
 * `actualDays` are measurable; the rest still count in the `coverage`
 * denominator so the caller can see how partial the sample is.
 *
 * @param rows - Task effort rows for the period.
 * @returns The actual/estimate ratio rounded to two decimals (`null` when the
 *   denominator is empty, never `NaN`/`Infinity`), the measured sample size,
 *   the measured fraction of the input, both sums, and the reliability gate.
 */
export function computeEstimateAccuracy(
  rows: readonly AccuracyTaskRow[],
): AccuracyResult {
  let n = 0
  let sumEstimate = 0
  let sumActual = 0

  for (const row of rows) {
    const estimate = toFiniteNumber(row.estimate)
    const actual = toFiniteNumber(row.actualDays)
    if (estimate === null || actual === null) continue
    if (estimate <= 0) continue
    n += 1
    sumEstimate += estimate
    sumActual += actual
  }

  const rawRatio = n > 0 && sumEstimate > 0 ? sumActual / sumEstimate : null
  const ratio =
    rawRatio !== null && Number.isFinite(rawRatio)
      ? Math.round(rawRatio * 100) / 100
      : null
  const coverage = rows.length > 0 ? n / rows.length : null

  return {
    ratio,
    n,
    coverage,
    sumEstimate,
    sumActual,
    reliable: n >= ESTIMATE_ACCURACY_MIN_SAMPLE,
  }
}

/**
 * Split rows by their `key` and compute the accuracy of each group.
 *
 * @param rows - Task effort rows carrying the grouping key.
 * @returns One {@link AccuracyResult} per key present in the input; `coverage`
 *   is relative to that group's own row count.
 */
export function accuracyByKey<K extends string>(
  rows: readonly (AccuracyTaskRow & { key: K })[],
): Record<K, AccuracyResult> {
  const groups = new Map<K, AccuracyTaskRow[]>()
  for (const row of rows) {
    const bucket = groups.get(row.key)
    if (bucket) bucket.push(row)
    else groups.set(row.key, [row])
  }

  const result = {} as Record<K, AccuracyResult>
  for (const [key, groupRows] of groups) {
    result[key] = computeEstimateAccuracy(groupRows)
  }
  return result
}
