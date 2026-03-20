export interface CalendarDeadline {
  id: string
  type: "INVOICE_DUE" | "TASK_DUE" | "RECURRING_EXPENSE"
  title: string
  date: string
  clientName: string
  clientId: string
  metadata: {
    invoiceId?: string
    taskId?: string
    expenseId?: string
    amount?: number
    status?: string
  }
}

export type DeadlineUrgency = "overdue" | "due-soon" | "upcoming"
export type CalendarView = "month" | "week" | "timeline"
