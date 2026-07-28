import type { BillingMode } from "@/generated/prisma/client"
import { pipelineValueForTask } from "@/lib/billing-math"

/**
 * One grouped row of the server-side billable aggregate: a client, its billing
 * terms, and the folded totals of its pipeline-eligible tasks.
 *
 * `estimateDays` is the sum of the non-null estimates over the group —
 * unestimated tasks contribute nothing to the value, matching
 * {@link pipelineValueForTask}, and are counted in `unestimatedCount` instead.
 */
export interface BillableGroupRow {
  clientId: string
  billingMode: BillingMode
  rate: number
  taskCount: number
  estimateDays: number
  unestimatedCount: number
}

export interface ClientBillableEntry {
  count: number
  value: number
  unestimatedCount: number
}

/**
 * Global billable aggregate: never paginated, never capped.
 *
 * `count` includes every billable task whatever the client's billing mode;
 * `value` excludes FIXED clients, which {@link pipelineValueForTask} values at
 * 0; `unestimatedCount` totals the tasks awaiting an estimate.
 */
export interface ClientsBillableSummary {
  byClient: Record<string, ClientBillableEntry>
  totalCount: number
  totalValue: number
  unestimatedCount: number
}

export const EMPTY_BILLABLE_SUMMARY: ClientsBillableSummary = {
  byClient: {},
  totalCount: 0,
  totalValue: 0,
  unestimatedCount: 0,
}

/**
 * Fold grouped billable rows into the per-client map plus the global totals.
 *
 * @param rows - One row per client that has at least one billable task.
 * @returns The per-client entries and the global count/value/unestimated totals.
 */
export function buildClientsBillableSummary(
  rows: readonly BillableGroupRow[],
): ClientsBillableSummary {
  const byClient: Record<string, ClientBillableEntry> = {}
  let totalCount = 0
  let totalValue = 0
  let unestimatedCount = 0

  for (const row of rows) {
    const value = pipelineValueForTask({
      billingMode: row.billingMode,
      rate: row.rate,
      estimateDays: row.estimateDays,
    })
    const previous = byClient[row.clientId]
    byClient[row.clientId] = {
      count: (previous?.count ?? 0) + row.taskCount,
      value: (previous?.value ?? 0) + value,
      unestimatedCount:
        (previous?.unestimatedCount ?? 0) + row.unestimatedCount,
    }
    totalCount += row.taskCount
    totalValue += value
    unestimatedCount += row.unestimatedCount
  }

  return { byClient, totalCount, totalValue, unestimatedCount }
}
