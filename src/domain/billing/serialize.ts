import type { Prisma } from "@/generated/prisma/client"
import { decimalToNumber } from "@/lib/api"
import { getInvoiceComputed } from "@/lib/payments"
import type {
  InvoiceDocStatus,
  InvoiceKind,
  InvoicePaymentStatus,
  InvoiceWireRow,
} from "./types"

export interface InvoiceRowForSerialize {
  id: string
  number: string
  clientId: string
  projectId: string | null
  status: InvoiceDocStatus
  paymentStatus: InvoicePaymentStatus
  kind: InvoiceKind
  issueDate: Date
  dueDate: Date
  subtotal: Prisma.Decimal
  tax: Prisma.Decimal
  total: Prisma.Decimal
  totalOverride: Prisma.Decimal | null
  notes: string | null
  _count: { lines: number }
  payments: { amount: Prisma.Decimal; paidAt: Date }[]
}

/**
 * Sole mapper from a Prisma invoice row (with `_count.lines` and `payments`)
 * to the canonical {@link InvoiceWireRow}. Every endpoint returning an invoice
 * list item routes through here so the wire shape stays byte-identical.
 */
export function serializeInvoice(inv: InvoiceRowForSerialize): InvoiceWireRow {
  const computed = getInvoiceComputed(inv)
  return {
    id: inv.id,
    number: inv.number,
    clientId: inv.clientId,
    projectId: inv.projectId,
    status: inv.status,
    paymentStatus: inv.paymentStatus,
    isOverdue: computed.isOverdue,
    kind: inv.kind,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    paidAmount: computed.paidAmount,
    balanceDue: computed.balanceDue,
    lastPaidAt: computed.lastPaidAt,
    subtotal: decimalToNumber(inv.subtotal) ?? 0,
    tax: decimalToNumber(inv.tax) ?? 0,
    total: decimalToNumber(inv.total) ?? 0,
    totalOverride: decimalToNumber(inv.totalOverride),
    notes: inv.notes,
    linesCount: inv._count.lines,
  }
}
