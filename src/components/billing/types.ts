import type { ClientTaskGroup } from "@/components/tasks/types"

/** Response shape from the uninvoiced billing API endpoint. */
export interface BillingApiResponse {
  groups: ClientTaskGroup[]
  grandTotal: number
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/** A group of invoiced tasks for a single calendar month. */
export interface HistoryMonthGroup {
  month: string
  label: string
  clients: ClientTaskGroup[]
  monthTotal: number
  taskCount: number
}

/** Response shape from the billing history API endpoint. */
export interface HistoryApiResponse {
  months: HistoryMonthGroup[]
  grandTotal: number
}
