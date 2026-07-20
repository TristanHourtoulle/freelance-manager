export const PIPELINE_FRESH_MAX_DAYS = 7
export const PIPELINE_STALE_DAYS = 30

const DAY_MS = 86_400_000

/**
 * One billable task reduced to what ageing needs: when it entered the queue and
 * how much money it represents.
 */
export interface AgingTaskRow {
  completedAt: Date | null
  value: number
}

/**
 * Age profile of the billable pipeline.
 *
 * `Task.completedAt` is the moment a task entered the billable queue —
 * `PENDING_INVOICE` is derived as completed with no `invoiceId` — so
 * `now − completedAt` is the queue age with no schema change.
 */
export interface PipelineAging {
  oldestDays: number | null
  staleCount: number
  staleValue: number
  buckets: { fresh: number; warm: number; stale: number; undated: number }
}

function ageInDays(now: Date, completedAt: Date): number {
  const raw = Math.floor((now.getTime() - completedAt.getTime()) / DAY_MS)
  return raw < 0 ? 0 : raw
}

/**
 * Bucket the billable pipeline by how long each task has been waiting.
 *
 * @param now - Reference instant, injected so the fold stays deterministic.
 * @param rows - Billable tasks with their queue-entry date and euro value.
 * @returns The oldest queue age in whole days (`null` when nothing is dated),
 *   the count and value of tasks older than {@link PIPELINE_STALE_DAYS}, and the
 *   fresh/warm/stale/undated bucket counts.
 */
export function buildPipelineAging(
  now: Date,
  rows: readonly AgingTaskRow[],
): PipelineAging {
  let oldestDays: number | null = null
  let staleCount = 0
  let staleValue = 0
  const buckets = { fresh: 0, warm: 0, stale: 0, undated: 0 }

  for (const row of rows) {
    if (row.completedAt === null) {
      buckets.undated += 1
      continue
    }
    const age = ageInDays(now, row.completedAt)
    if (oldestDays === null || age > oldestDays) oldestDays = age

    if (age <= PIPELINE_FRESH_MAX_DAYS) buckets.fresh += 1
    else if (age <= PIPELINE_STALE_DAYS) buckets.warm += 1
    else {
      buckets.stale += 1
      staleCount += 1
      staleValue += Number.isFinite(row.value) ? row.value : 0
    }
  }

  return { oldestDays, staleCount, staleValue, buckets }
}
