export interface TaskOverrideDTO {
  linearIssueId: string
  toInvoice: boolean
  invoiced: boolean
  invoicedAt: string | null
  rateOverride: number | null
}

export interface TaskStatusDTO {
  name: string
  type: string
  color: string
}

export interface EnrichedTask {
  linearIssueId: string
  identifier: string
  title: string
  estimate: number | undefined
  status: TaskStatusDTO | undefined
  url: string
  priorityLabel: string
  billingAmount: number
  billingFormula: string
  toInvoice: boolean
  invoiced: boolean
  rateOverride: number | null
}

export interface ClientSummary {
  id: string
  name: string
  company: string | null
  billingMode: string
  rate: number
}

export interface ClientTaskGroup {
  client: ClientSummary
  tasks: EnrichedTask[]
  totalBilling: number
  taskCount: number
}

export interface TasksApiResponse {
  groups: ClientTaskGroup[]
  lastSyncedAt: number | null
  isStale: boolean
}
