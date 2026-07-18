import type { BuilderLine } from "@/domain/billing/builder"
import type { InvoiceDetail, InvoiceKind } from "@/domain/billing/types"
import type { ClientDTO } from "@/hooks/use-clients"
import type { TaskDTO } from "@/hooks/use-tasks"
import type { ProjectDTO } from "@/hooks/use-projects"

export type CreateStatus = "DRAFT" | "SENT"
export type EditStatus = "DRAFT" | "SENT" | "CANCELLED"
export type SplitSchedule = "MONTHLY" | "WEEKLY" | "ONCE"

export interface CreateBuilderArgs {
  mode: "create"
  preselectedTaskIds: string[]
  initialClientId: string
}

export interface EditBuilderArgs {
  mode: "edit"
  invoice: InvoiceDetail
}

export interface BuilderBase {
  clients: ClientDTO[]
  projects: ProjectDTO[]
  tasks: TaskDTO[]
  client: ClientDTO | undefined
  clientId: string
  projectId: string
  setProjectId: (v: string) => void
  taskSearch: string
  setTaskSearch: (v: string) => void
  issueDate: string
  setIssueDate: (v: string) => void
  dueDate: string
  setDueDate: (v: string) => void
  kind: InvoiceKind
  setKind: (v: InvoiceKind) => void
  customNumber: string
  setCustomNumber: (v: string) => void
  depositLabel: string
  setDepositLabel: (v: string) => void
  depositAmount: number
  setDepositAmount: (v: number) => void
  lines: BuilderLine[]
  useTotalOverride: boolean
  totalOverride: number
  setTotalOverrideValue: (amount: number) => void
  clearTotalOverride: () => void
  dragOver: boolean
  setDragOver: (v: boolean) => void
  projectById: Map<string, ProjectDTO>
  eligibleTasks: TaskDTO[]
  subtotal: number
  effectiveTotal: number
  addTask: (task: TaskDTO) => void
  addTaskById: (taskId: string) => void
  addBlank: () => void
  updateLine: (id: string, patch: Partial<BuilderLine>) => void
  removeLine: (id: string) => void
}

export interface CreateInvoiceBuilder extends BuilderBase {
  mode: "create"
  selectClient: (id: string) => void
  initialStatus: CreateStatus
  setInitialStatus: (v: CreateStatus) => void
  markPaid: boolean
  setMarkPaid: (v: boolean) => void
  paidAt: string
  setPaidAt: (v: string) => void
  showSplit: boolean
  setShowSplit: (v: boolean) => void
  isPending: boolean
  isSplitPending: boolean
  submit: (status: CreateStatus) => void
  doSplit: (parts: number, schedule: SplitSchedule) => void
}

export interface EditInvoiceBuilder extends BuilderBase {
  mode: "edit"
  invoice: InvoiceDetail
  status: EditStatus
  setStatus: (v: EditStatus) => void
  hasPayments: boolean
  isPending: boolean
  save: (status: EditStatus) => void
}

export type InvoiceBuilder = CreateInvoiceBuilder | EditInvoiceBuilder
