export interface CalendarDeadline {
  id: string
  type: "INVOICE_DUE" | "TASK_DUE"
  title: string
  date: string
  clientName: string
  clientId: string
  metadata: {
    invoiceId?: string
    taskId?: string
    amount?: number
    status?: string
  }
}

export type DeadlineUrgency = "overdue" | "due-soon" | "upcoming"
export type CalendarView = "month" | "week" | "timeline"
