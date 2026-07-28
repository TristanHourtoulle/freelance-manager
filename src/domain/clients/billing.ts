import type {
  BillingMode,
  ClientCategory,
  TaskStatus,
} from "@/generated/prisma/client"
import { isPipelineEligible } from "@/domain/tasks/billability"
import { pipelineValueForTask } from "@/lib/billing-math"

/**
 * Task fields required by the pipeline gate and the pipeline valuation.
 */
export interface BillableTaskRow {
  status: TaskStatus
  invoiceId: string | null
  billable: boolean
  estimate: number | null
}

/**
 * Client billing terms and pipeline gate fields with the cached task rows.
 */
export interface ClientBillingInput<T extends BillableTaskRow> {
  billingMode: BillingMode
  rate: number
  archivedAt: string | null
  category: ClientCategory
  tasks: T[]
}

/**
 * Billable task subset and its total pipeline value in euros.
 */
export interface ClientBillingSummary<T extends BillableTaskRow> {
  billableTasks: T[]
  pipelineValue: number
}

/**
 * Derive the client's billable pipeline from its cached tasks.
 *
 * The gate is the canonical `isPipelineEligible` filter: a task must be
 * `PENDING_INVOICE`, uninvoiced and billable, on an active FREELANCE client.
 * The pipeline value sums `pipelineValueForTask` over that set (FIXED clients
 * and unestimated tasks contribute 0).
 *
 * @param client - Billing terms, pipeline gate fields and cached task rows.
 * @returns The billable task subset and its total pipeline value in euros.
 */
export function deriveClientBilling<T extends BillableTaskRow>(
  client: ClientBillingInput<T>,
): ClientBillingSummary<T> {
  const gate = { archivedAt: client.archivedAt, category: client.category }
  const billableTasks = client.tasks.filter((t) =>
    isPipelineEligible(
      { status: t.status, invoiceId: t.invoiceId, billable: t.billable },
      gate,
    ),
  )
  const pipelineValue = billableTasks.reduce(
    (sum, t) =>
      sum +
      pipelineValueForTask({
        billingMode: client.billingMode,
        rate: client.rate,
        estimateDays: t.estimate,
      }),
    0,
  )
  return { billableTasks, pipelineValue }
}
