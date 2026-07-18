/**
 * Canonical billing wire types.
 *
 * Single source of truth for the invoice shapes that cross the network
 * boundary. Imported by the server data layer, the API routes, and the
 * client hooks so all four stay byte-identical. This module is pure: no
 * React, no `next/*`, no Prisma runtime import.
 */

export type InvoiceDocStatus = "DRAFT" | "SENT" | "CANCELLED"

export type InvoicePaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERPAID"

export type InvoiceKind = "STANDARD" | "DEPOSIT"

export interface InvoicePaymentDTO {
  id: string
  amount: number
  paidAt: string
  method: string | null
  note: string | null
  createdAt: string
}

export interface InvoiceWireRow {
  id: string
  number: string
  clientId: string
  projectId: string | null
  status: InvoiceDocStatus
  paymentStatus: InvoicePaymentStatus
  isOverdue: boolean
  kind: InvoiceKind
  issueDate: string
  dueDate: string
  paidAmount: number
  balanceDue: number
  lastPaidAt: string | null
  subtotal: number
  tax: number
  total: number
  totalOverride: number | null
  notes: string | null
  linesCount: number
}

export interface InvoiceDetail extends InvoiceWireRow {
  client: {
    id: string
    firstName: string
    lastName: string
    company: string | null
    email: string | null
    billingMode: "DAILY" | "FIXED" | "HOURLY"
    color: string | null
  }
  lines: {
    id: string
    taskId: string | null
    label: string
    qty: number
    rate: number
  }[]
  payments: InvoicePaymentDTO[]
}
