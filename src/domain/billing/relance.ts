import type { Prisma } from "@/generated/prisma/client"
import { getInvoiceComputed } from "@/lib/payments"
import type { InvoiceDocStatus, InvoicePaymentStatus } from "./types"

type DecimalLike = Prisma.Decimal | number

export interface RelanceInvoiceRow {
  id: string
  number: string
  clientId: string
  status: InvoiceDocStatus
  paymentStatus: InvoicePaymentStatus
  total: DecimalLike
  dueDate: Date
  payments: { amount: DecimalLike; paidAt: Date }[]
}

export interface RelanceActionRow {
  userId: string
  clientId: string
  type: "RELANCE"
  title: string
  dueDate: Date
  invoiceId: string
  relanceInvoiceId: string
}

export interface BuildRelanceRowsInput {
  userId: string
  now: Date
  invoices: RelanceInvoiceRow[]
  existingRelanceInvoiceIds?: readonly string[]
}

/**
 * French title of the follow-up action generated for an overdue invoice.
 *
 * @param invoiceNumber - The invoice's human-readable number.
 * @returns The action title shown in the follow-up queue.
 */
export function relanceTitle(invoiceNumber: string): string {
  return `Relancer la facture ${invoiceNumber}`
}

/**
 * Build the RELANCE action rows owed for a batch of invoices.
 *
 * Eligibility is recomputed from the payment rows via `getInvoiceComputed`:
 * an invoice qualifies only when it is `isOverdue` AND still owes money
 * (`balanceDue > 0`). The cached `paymentStatus` column is never trusted on
 * its own, so a stale column can never auto-dun a client who already paid.
 *
 * `existingRelanceInvoiceIds` is only a cheap pre-filter to avoid pointless
 * writes. The authoritative guard is the nullable UNIQUE `relanceInvoiceId`
 * column, enforced by the database through `createMany({ skipDuplicates })`
 * or a `P2002` catch — never by a read-then-write check.
 *
 * One auto-relance per invoice, ever: `relanceInvoiceId` is never cleared,
 * not even when the action is marked DONE, so marking it done does not
 * resurrect it. Further relances are created manually via the action modal.
 *
 * @param input - Owner id, reference date, candidate invoices, ids already covered.
 * @returns The rows to insert, at most one per invoice.
 */
export function buildRelanceRows(
  input: BuildRelanceRowsInput,
): RelanceActionRow[] {
  const { userId, now, invoices, existingRelanceInvoiceIds = [] } = input
  const covered = new Set(existingRelanceInvoiceIds)

  const rows: RelanceActionRow[] = []
  const seen = new Set<string>()

  for (const invoice of invoices) {
    if (covered.has(invoice.id) || seen.has(invoice.id)) continue
    const { isOverdue, balanceDue } = getInvoiceComputed(invoice)
    if (!isOverdue || balanceDue <= 0) continue
    seen.add(invoice.id)
    rows.push({
      userId,
      clientId: invoice.clientId,
      type: "RELANCE",
      title: relanceTitle(invoice.number),
      dueDate: now,
      invoiceId: invoice.id,
      relanceInvoiceId: invoice.id,
    })
  }

  return rows
}
