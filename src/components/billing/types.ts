import type { ClientTaskGroup } from "@/components/tasks/types"

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

export interface HistoryMonthGroup {
  month: string
  label: string
  clients: ClientTaskGroup[]
  monthTotal: number
  taskCount: number
}

export interface HistoryApiResponse {
  months: HistoryMonthGroup[]
  grandTotal: number
}
