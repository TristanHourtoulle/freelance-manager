import "server-only"
import type { Prisma, PaymentStatus } from "@/generated/prisma/client"
import { decimalToNumber } from "@/lib/api"

type TxClient = Prisma.TransactionClient

interface InvoiceForCompute {
  status: "DRAFT" | "SENT" | "CANCELLED"
  paymentStatus: PaymentStatus
  dueDate: Date
  total: Prisma.Decimal | number
  payments: { amount: Prisma.Decimal | number; paidAt: Date }[]
}

interface InvoiceComputed {
  paidAmount: number
  balanceDue: number
  isOverdue: boolean
  lastPaidAt: string | null
}

/**
 * Recompute the invoice's cached `paymentStatus` from the sum of its payments.
 *
 * Must be called inside a transaction whenever payments are created, updated,
 * or deleted, or when the invoice total changes. Keeps the column accurate
 * without DB triggers.
 *
 * @returns the new payment status
 */
export async function recomputeInvoicePayment(
  invoiceId: string,
  tx: TxClient,
): Promise<PaymentStatus> {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { total: true },
  })
  const sum = await tx.payment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  })

  const total = Number(invoice.total)
  const paid = Number(sum._sum.amount ?? 0)

  let next: PaymentStatus = "UNPAID"
  if (paid <= 0) next = "UNPAID"
  else if (paid < total) next = "PARTIALLY_PAID"
  else if (paid === total) next = "PAID"
  else next = "OVERPAID"

  await tx.invoice.update({
    where: { id: invoiceId },
    data: { paymentStatus: next },
  })

  return next
}

/**
 * Compute derived attributes from an invoice + its payments.
 *
 * `isOverdue` is true when the invoice is SENT, not fully paid, and past
 * its due date. `balanceDue` is total minus payments (negative if overpaid).
 */
export function getInvoiceComputed(
  invoice: InvoiceForCompute,
): InvoiceComputed {
  const total = Number(invoice.total)
  const paidAmount = invoice.payments.reduce((s, p) => s + Number(p.amount), 0)
  const balanceDue = total - paidAmount
  const isOverdue =
    invoice.status === "SENT" &&
    invoice.paymentStatus !== "PAID" &&
    invoice.paymentStatus !== "OVERPAID" &&
    invoice.dueDate.getTime() < Date.now()

  const lastPaidAt = invoice.payments
    .map((p) => p.paidAt)
    .sort((a, b) => b.getTime() - a.getTime())[0]

  return {
    paidAmount,
    balanceDue,
    isOverdue,
    lastPaidAt: lastPaidAt ? lastPaidAt.toISOString() : null,
  }
}

/**
 * Convenience: serialize a Payment row into the API DTO shape.
 */
export function serializePayment(p: {
  id: string
  amount: Prisma.Decimal | number
  paidAt: Date
  method: string | null
  note: string | null
  createdAt: Date
}) {
  return {
    id: p.id,
    amount: decimalToNumber(p.amount) ?? 0,
    paidAt: p.paidAt.toISOString(),
    method: p.method,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
  }
}
