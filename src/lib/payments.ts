import "server-only"
import type { Prisma, PaymentStatus } from "@/generated/prisma/client"
import { decimalToNumber } from "@/lib/api"
import { computeLateFee } from "@/domain/billing/late-fee"
import type { InvoiceDocStatus } from "@/domain/billing/types"
import {
  DEFAULT_LATE_FEE_ANNUAL_RATE,
  DEFAULT_LATE_FEE_FIXED_AMOUNT,
} from "@/lib/schemas/settings"

type TxClient = Prisma.TransactionClient

export interface LateFeePolicy {
  fixedAmount: number
  annualRate: number
}

const DEFAULT_LATE_FEE_POLICY: LateFeePolicy = {
  fixedAmount: DEFAULT_LATE_FEE_FIXED_AMOUNT,
  annualRate: DEFAULT_LATE_FEE_ANNUAL_RATE,
}

interface LateFeeSettingsRow {
  lateFeeFixedAmount?: Prisma.Decimal | number | null
  lateFeeAnnualRate?: Prisma.Decimal | number | null
}

/**
 * Resolve the operator's real late-fee policy from a `UserSettings` row.
 *
 * Falls back to {@link DEFAULT_LATE_FEE_FIXED_AMOUNT} /
 * {@link DEFAULT_LATE_FEE_ANNUAL_RATE} — the same defaults mirrored by the
 * Prisma column defaults — whenever a column is unset or the row itself
 * does not exist yet. `settings.ts` is the single source of truth for those
 * two numbers; every caller that needs a live {@link LateFeePolicy} should
 * go through this helper instead of rebuilding the fallback inline.
 *
 * @param settings - The row's `lateFeeFixedAmount` / `lateFeeAnnualRate`
 *   columns, or `null` when the user has no settings row yet.
 * @returns The policy to feed into {@link getInvoiceComputed} and
 *   {@link computeLateFee}.
 */
export function resolveLateFeePolicy(
  settings: LateFeeSettingsRow | null | undefined,
): LateFeePolicy {
  return {
    fixedAmount:
      decimalToNumber(settings?.lateFeeFixedAmount) ??
      DEFAULT_LATE_FEE_FIXED_AMOUNT,
    annualRate:
      decimalToNumber(settings?.lateFeeAnnualRate) ??
      DEFAULT_LATE_FEE_ANNUAL_RATE,
  }
}

interface InvoiceLateFeeState {
  lateFeeFixed?: Prisma.Decimal | number
  lateFeeInterest?: Prisma.Decimal | number
  lateFeeClaimedAt?: Date | null
  lateFeeWaived?: boolean
}

interface InvoiceForCompute extends InvoiceLateFeeState {
  status: InvoiceDocStatus
  paymentStatus: PaymentStatus
  dueDate: Date
  total: Prisma.Decimal | number
  payments: {
    amount: Prisma.Decimal | number
    paidAt: Date
    penaltyAmount?: Prisma.Decimal | number
  }[]
}

interface InvoiceComputed {
  paidAmount: number
  balanceDue: number
  isOverdue: boolean
  lastPaidAt: string | null
  lateFeeDue: number
  lateFeeAccrued: number
  penaltyPaid: number
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function toCents(value: number): number {
  return Math.round(value * 100)
}

/**
 * Derive the frozen late-fee amount owed on an invoice.
 *
 * Zero when the fee has never been claimed, or when it was claimed but has
 * since been waived. Otherwise the rounded sum of the `lateFeeFixed` and
 * `lateFeeInterest` amounts frozen on the invoice at claim time — this never
 * re-derives from `computeLateFee`, so a later payment or the passage of
 * time cannot silently change what is owed.
 *
 * @param invoice - The invoice's late-fee columns.
 * @returns The amount due for the late fee, in euros, rounded to cents.
 */
function deriveLateFeeDue(invoice: InvoiceLateFeeState): number {
  if (invoice.lateFeeWaived || !invoice.lateFeeClaimedAt) return 0
  return round2(
    Number(invoice.lateFeeFixed ?? 0) + Number(invoice.lateFeeInterest ?? 0),
  )
}

/**
 * Recompute the invoice's cached `paymentStatus` from the sum of its
 * payments compared against the total plus any claimed, unwaived late fee.
 *
 * Must be called inside a transaction whenever payments are created, updated,
 * or deleted, or when the invoice total or late-fee state changes. Keeps the
 * column accurate without DB triggers. The comparison rounds both sides to
 * cents first, so summing many Decimal payments never misses the PAID
 * boundary by a fraction of a cent.
 *
 * @returns the new payment status
 */
export async function recomputeInvoicePayment(
  invoiceId: string,
  tx: TxClient,
): Promise<PaymentStatus> {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: {
      total: true,
      lateFeeFixed: true,
      lateFeeInterest: true,
      lateFeeClaimedAt: true,
      lateFeeWaived: true,
    },
  })
  const sum = await tx.payment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  })

  const total = Number(invoice.total)
  const lateFeeDue = deriveLateFeeDue(invoice)
  const amountDue = round2(total + lateFeeDue)
  const paid = Number(sum._sum.amount ?? 0)

  const paidCents = toCents(paid)
  const amountDueCents = toCents(amountDue)

  let next: PaymentStatus = "UNPAID"
  if (paidCents <= 0) next = "UNPAID"
  else if (paidCents < amountDueCents) next = "PARTIALLY_PAID"
  else if (paidCents === amountDueCents) next = "PAID"
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
 * `balanceDue` is `total` plus the frozen `lateFeeDue` (0 unless the fee was
 * claimed and is not waived), minus payments — negative if overpaid, and
 * rounded to cents so a Decimal-precise settlement never leaves a
 * fraction-of-a-cent residue. `isOverdue` keeps its original semantics
 * (SENT, past due, `balanceDue > 0`) unchanged in form: because `balanceDue`
 * now folds in the unpaid late fee, an invoice whose principal is settled
 * but whose claimed penalty is not stays overdue, so it is never dropped
 * from the relance sweep. The stale `paymentStatus` column is never trusted
 * on its own for this either.
 *
 * `lateFeeAccrued` is a live preview — via {@link computeLateFee} — of what
 * a claim would be worth right now, independent of whether one has actually
 * been claimed; it never affects `balanceDue`. `lateFeePolicy` feeds only
 * this preview and defaults to a flat 40 EUR fixed fee plus a 10% annual
 * rate when omitted; a caller that has the operator's real
 * `UserSettings.lateFeeFixedAmount` / `lateFeeAnnualRate` should pass them
 * explicitly for an accurate preview.
 *
 * @param invoice - The invoice row plus its payments.
 * @param lateFeePolicy - Optional fixed amount / annual rate for the
 *   not-yet-claimed accrual preview; defaults to 40 EUR / 10%.
 */
export function getInvoiceComputed(
  invoice: InvoiceForCompute,
  lateFeePolicy: LateFeePolicy = DEFAULT_LATE_FEE_POLICY,
): InvoiceComputed {
  const total = Number(invoice.total)
  const paidAmount = invoice.payments.reduce((s, p) => s + Number(p.amount), 0)
  const penaltyPaid = invoice.payments.reduce(
    (s, p) => s + Number(p.penaltyAmount ?? 0),
    0,
  )

  const lateFeeDue = deriveLateFeeDue(invoice)
  const amountDue = round2(total + lateFeeDue)
  const balanceDue = round2(amountDue - paidAmount)

  const lateFeeAccrued = computeLateFee({
    total,
    dueDate: invoice.dueDate,
    status: invoice.status,
    payments: invoice.payments.map((p) => ({
      amount: Number(p.amount),
      paidAt: p.paidAt,
    })),
    fixedAmount: lateFeePolicy.fixedAmount,
    annualRate: lateFeePolicy.annualRate,
    asOf: new Date(),
  }).total

  const isOverdue =
    invoice.status === "SENT" &&
    invoice.paymentStatus !== "PAID" &&
    invoice.paymentStatus !== "OVERPAID" &&
    balanceDue > 0 &&
    invoice.dueDate.getTime() < Date.now()

  let lastPaidAt: Date | null = null
  for (const p of invoice.payments) {
    if (!lastPaidAt || p.paidAt.getTime() > lastPaidAt.getTime()) {
      lastPaidAt = p.paidAt
    }
  }

  return {
    paidAmount,
    balanceDue,
    isOverdue,
    lastPaidAt: lastPaidAt ? lastPaidAt.toISOString() : null,
    lateFeeDue,
    lateFeeAccrued,
    penaltyPaid,
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
  penaltyAmount: Prisma.Decimal | number
}) {
  return {
    id: p.id,
    amount: decimalToNumber(p.amount) ?? 0,
    paidAt: p.paidAt.toISOString(),
    method: p.method,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    penaltyAmount: decimalToNumber(p.penaltyAmount) ?? 0,
  }
}
