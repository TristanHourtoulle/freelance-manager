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
