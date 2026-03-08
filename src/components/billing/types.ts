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

/** Invoice status for a client within a month. */
export interface InvoiceInfo {
  id: string
  status: "DRAFT" | "SENT" | "PAID"
  totalAmount: number
}

/** A client group within history, with optional invoice info. */
export interface HistoryClientGroup extends ClientTaskGroup {
  invoice?: InvoiceInfo
}

/** A group of invoiced tasks for a single calendar month. */
export interface HistoryMonthGroup {
  month: string
  label: string
  clients: HistoryClientGroup[]
  monthTotal: number
  taskCount: number
}

/** Response shape from the billing history API endpoint. */
export interface HistoryApiResponse {
  months: HistoryMonthGroup[]
  grandTotal: number
}
