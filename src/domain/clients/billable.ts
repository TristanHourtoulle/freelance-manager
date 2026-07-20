import type { BillingMode } from "@/generated/prisma/client"
import { pipelineValueForTask } from "@/lib/billing-math"

/**
 * One grouped row of the server-side billable aggregate: a client, its billing
 * terms, and the folded totals of its billable tasks.
 *
 * `estimateDays` is the sum of `COALESCE(estimate, 1)` over the group, mirroring
 * the per-task default used by {@link pipelineValueForTask}.
 */
export interface BillableGroupRow {
  clientId: string
  billingMode: BillingMode
  rate: number
  taskCount: number
  estimateDays: number
}

export interface ClientBillableEntry {
  count: number
  value: number
}

/**
 * Global billable aggregate: never paginated, never capped.
 *
 * `count` includes every billable task whatever the client's billing mode;
 * `value` excludes FIXED clients, which {@link pipelineValueForTask} values at 0.
 */
export interface ClientsBillableSummary {
  byClient: Record<string, ClientBillableEntry>
  totalCount: number
  totalValue: number
}

export const EMPTY_BILLABLE_SUMMARY: ClientsBillableSummary = {
  byClient: {},
  totalCount: 0,
  totalValue: 0,
}

/**
 * Fold grouped billable rows into the per-client map plus the global totals.
 *
 * @param rows - One row per client that has at least one billable task.
 * @returns The per-client entries and the global count/value totals.
 */
export function buildClientsBillableSummary(
  rows: readonly BillableGroupRow[],
): ClientsBillableSummary {
  const byClient: Record<string, ClientBillableEntry> = {}
  let totalCount = 0
  let totalValue = 0

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
    }
    totalCount += row.taskCount
    totalValue += value
  }

  return { byClient, totalCount, totalValue }
}
