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

export interface TaskDetailResponse {
  issue: {
    id: string
    identifier: string
    title: string
    description: string | undefined
    estimate: number | undefined
    completedAt: string | undefined
    createdAt: string
    updatedAt: string
    dueDate: string | undefined
    url: string
    priority: number
    priorityLabel: string
    status: TaskStatusDTO | undefined
    assignee:
      | { id: string; name: string; email: string | undefined }
      | undefined
    labels: Array<{ id: string; name: string; color: string }>
    projectId: string | undefined
    projectName: string | undefined
    teamId: string | undefined
  }
  override: TaskOverrideDTO | null
  billing: { amount: number; formula: string } | null
  client: { id: string; name: string; billingMode: string; rate: number } | null
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
