import type { Prisma } from "@/generated/prisma/client"

type DecimalLike = Prisma.Decimal | number

export interface OpenTaskEffortRow {
  estimate: DecimalLike | null
}

export interface WorkloadSummary {
  days: number
  taskCount: number
  estimatedTaskCount: number
  missingEstimateCount: number
}

export const DEFAULT_WORKING_DAYS_PER_WEEK = 5
export const MIN_WORKING_DAYS_PER_WEEK = 1
export const MAX_WORKING_DAYS_PER_WEEK = 7

const DAYS_PER_WEEK = 7

function toFiniteNumber(value: DecimalLike | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === "number" ? value : value.toNumber()
  return Number.isFinite(n) ? n : null
}

function toUtcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/**
 * Summarize the remaining work carried by a set of open tasks.
 *
 * Sums `estimate` only, never `actualDays`: `effortDaysForTask` in
 * `@/domain/analytics/effective-rate` deliberately prefers effort already
 * spent, which under-reports forward-looking queued work. An estimate of
 * exactly `0` counts as estimated and contributes zero days.
 *
 * @param rows - Open task rows carrying their estimate column.
 * @returns The queued days plus the estimate-coverage counts.
 */
export function summarizeWorkload(
  rows: readonly OpenTaskEffortRow[],
): WorkloadSummary {
  let days = 0
  let estimatedTaskCount = 0
  for (const row of rows) {
    const value = toFiniteNumber(row.estimate)
    if (value === null) continue
    days += value
    estimatedTaskCount++
  }
  return {
    days,
    taskCount: rows.length,
    estimatedTaskCount,
    missingEstimateCount: rows.length - estimatedTaskCount,
  }
}

/**
 * Format a day count for display, in French.
 *
 * @param days - The day count.
 * @returns The count with at most one decimal, followed by the day unit.
 */
export function formatWorkloadDays(days: number): string {
  const safe = Number.isFinite(days) ? days : 0
  return `${safe.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`
}

/**
 * Build the honesty line stating how many open tasks lack an estimate.
 *
 * @param summary - A workload summary.
 * @returns The French coverage sentence.
 */
export function formatWorkloadCoverage(summary: WorkloadSummary): string {
  if (summary.taskCount === 0) return "Aucune tâche ouverte"
  const plural = summary.taskCount > 1 ? "s" : ""
  if (summary.missingEstimateCount > 0) {
    return `${summary.taskCount} tâche${plural} · ${summary.missingEstimateCount} sans estimation`
  }
  return `${summary.taskCount} tâche${plural} · toutes estimées`
}

/**
 * Clamp the user-configured working days per week into the supported range.
 *
 * @param value - The persisted setting, possibly absent or invalid.
 * @returns An integer between the min and max working days per week.
 */
export function clampWorkingDaysPerWeek(
  value: number | null | undefined,
): number {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_WORKING_DAYS_PER_WEEK
  }
  return Math.min(
    MAX_WORKING_DAYS_PER_WEEK,
    Math.max(MIN_WORKING_DAYS_PER_WEEK, Math.round(value)),
  )
}

/**
 * Count the working days available between now and a target date.
 *
 * Both dates are normalized to UTC midnight because Linear target dates come
 * from the `TimelessDate` scalar, which parses as UTC midnight.
 *
 * @param target - The target date.
 * @param now - The reference instant.
 * @param workingDaysPerWeek - The user's weekly capacity in days.
 * @returns The number of working days left, never negative.
 */
export function businessDaysUntil(
  target: Date,
  now: Date,
  workingDaysPerWeek: number,
): number {
  const calendarDays = Math.round(
    (toUtcMidnight(target) - toUtcMidnight(now)) / 86_400_000,
  )
  if (calendarDays <= 0) return 0
  return Math.floor(
    (calendarDays * clampWorkingDaysPerWeek(workingDaysPerWeek)) /
      DAYS_PER_WEEK,
  )
}

/**
 * Decide whether a project cannot fit its remaining work before its target.
 *
 * Always `false` when the project has no Linear target date: most projects have
 * none and the flag must never fire on them.
 *
 * @param input - Remaining estimated days, target date, reference instant and weekly capacity.
 * @returns `true` when the remaining work exceeds the working days left.
 */
export function deriveAtRisk(input: {
  remainingDays: number
  targetDate: Date | null
  now: Date
  workingDaysPerWeek: number
}): boolean {
  const { remainingDays, targetDate, now, workingDaysPerWeek } = input
  if (targetDate === null) return false
  if (!Number.isFinite(remainingDays) || remainingDays <= 0) return false
  return remainingDays > businessDaysUntil(targetDate, now, workingDaysPerWeek)
}
