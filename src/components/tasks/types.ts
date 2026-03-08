/** User-defined overrides for a task's billing and invoicing state. */
export interface TaskOverrideDTO {
  linearIssueId: string
  toInvoice: boolean
  invoiced: boolean
  invoicedAt: string | null
  rateOverride: number | null
}

/** Linear workflow status label and color. */
export interface TaskStatusDTO {
  id: string
  name: string
  type: string
  color: string
}

/** A Linear issue enriched with billing calculations and override flags. */
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

/** Full detail payload for a single task, returned by the task detail API. */
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

/** Lightweight client info used in task filters and group headers. */
export interface ClientSummary {
  id: string
  name: string
  company: string | null
  billingMode: string
  rate: number
}

/** Group of tasks belonging to a single client, with billing totals. */
export interface ClientTaskGroup {
  client: ClientSummary
  tasks: EnrichedTask[]
  totalBilling: number
  taskCount: number
}

/** A task enriched with the client name, used for the Kanban board flat list. */
export interface KanbanTask extends EnrichedTask {
  clientName: string
}

/** Response shape from the tasks list API endpoint. */
export interface TasksApiResponse {
  groups: ClientTaskGroup[]
  lastSyncedAt: number | null
  isStale: boolean
}
