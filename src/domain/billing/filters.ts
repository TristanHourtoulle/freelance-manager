import type { InvoiceWireRow } from "@/domain/billing/types"

/**
 * Canonical invoice list filter identifiers.
 *
 * Superset of the desktop and mobile filter sets: `OVERPAID` is included so a
 * single matcher covers both surfaces (the mobile list simply does not render
 * an `OVERPAID` chip, but now shares the same OVERPAID-aware logic).
 */
export type InvoiceFilterId =
  | "all"
  | "DRAFT"
  | "SENT"
  | "PARTIAL"
  | "PAID"
  | "OVERPAID"
  | "OVERDUE"

type InvoiceFilterRow = Pick<
  InvoiceWireRow,
  "status" | "paymentStatus" | "isOverdue"
>

type InvoiceSummaryRow = InvoiceFilterRow &
  Pick<InvoiceWireRow, "paidAmount" | "balanceDue">

/**
 * Decides whether an invoice belongs to a given list filter.
 *
 * Canonical desktop behavior, including the `OVERPAID` branch. `all` matches
 * everything; `SENT` is the strict "issued, unpaid, not overdue" bucket.
 *
 * @param invoice - Minimal invoice row (status, payment status, overdue flag).
 * @param filter - The active filter identifier.
 * @returns `true` when the invoice should appear under `filter`.
 */
export function matchesInvoiceFilter(
  invoice: InvoiceFilterRow,
  filter: InvoiceFilterId,
): boolean {
  if (filter === "all") return true
  if (filter === "DRAFT") return invoice.status === "DRAFT"
  if (filter === "SENT")
    return (
      invoice.status === "SENT" &&
      invoice.paymentStatus === "UNPAID" &&
      !invoice.isOverdue
    )
  if (filter === "PARTIAL") return invoice.paymentStatus === "PARTIALLY_PAID"
  if (filter === "PAID") return invoice.paymentStatus === "PAID"
  if (filter === "OVERPAID") return invoice.paymentStatus === "OVERPAID"
  if (filter === "OVERDUE") return invoice.isOverdue
  return true
}

export interface InvoiceCounts {
  all: number
  draft: number
  sent: number
  partial: number
  paid: number
  overpaid: number
  overdue: number
}

export interface InvoiceTotals {
  paid: number
  outstanding: number
  overdue: number
}

/**
 * Single-pass count + money aggregation over an invoice list.
 *
 * Counts each filter bucket and sums the paid, outstanding and overdue money
 * totals in one loop. Both the desktop and mobile lists consume the counts;
 * the desktop list additionally consumes the totals.
 *
 * @param invoices - The invoices to summarize.
 * @returns The per-filter counts and the paid/outstanding/overdue money totals.
 */
export function summarizeInvoices(invoices: readonly InvoiceSummaryRow[]): {
  counts: InvoiceCounts
  totals: InvoiceTotals
} {
  let draft = 0
  let sent = 0
  let partial = 0
  let paid = 0
  let overpaid = 0
  let overdue = 0
  let paidTotal = 0
  let outstandingTotal = 0
  let overdueTotal = 0

  for (const i of invoices) {
    if (matchesInvoiceFilter(i, "DRAFT")) draft++
    if (matchesInvoiceFilter(i, "SENT")) sent++
    if (matchesInvoiceFilter(i, "PARTIAL")) partial++
    if (matchesInvoiceFilter(i, "PAID")) paid++
    if (matchesInvoiceFilter(i, "OVERPAID")) overpaid++
    if (matchesInvoiceFilter(i, "OVERDUE")) overdue++
    if (i.paymentStatus === "PAID" || i.paymentStatus === "OVERPAID") {
      paidTotal += i.paidAmount
    }
    if (
      i.status === "SENT" &&
      (i.paymentStatus === "UNPAID" || i.paymentStatus === "PARTIALLY_PAID")
    ) {
      outstandingTotal += i.balanceDue
    }
    if (i.isOverdue) overdueTotal += i.balanceDue
  }

  return {
    counts: {
      all: invoices.length,
      draft,
      sent,
      partial,
      paid,
      overpaid,
      overdue,
    },
    totals: {
      paid: paidTotal,
      outstanding: outstandingTotal,
      overdue: overdueTotal,
    },
  }
}
