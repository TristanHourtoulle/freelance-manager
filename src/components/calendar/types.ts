export interface CalendarDeadline {
  id: string
  type: "INVOICE_DUE"
  title: string
  date: string
  clientName: string
  clientId: string
  metadata: {
    invoiceId: string
    amount: number
    status: string
  }
}

export type DeadlineUrgency = "overdue" | "due-soon" | "upcoming"
