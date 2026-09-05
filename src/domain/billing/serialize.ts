import type { Prisma } from "@/generated/prisma/client"
import { decimalToNumber } from "@/lib/api"
import { getInvoiceComputed, type LateFeePolicy } from "@/lib/payments"
import { computeLateFee } from "./late-fee"
import type {
  InvoiceDocStatus,
  InvoiceKind,
  InvoiceLateFeeBreakdown,
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
  subtotal: Prisma.Decimal | number
  tax: Prisma.Decimal | number
  total: Prisma.Decimal | number
  totalOverride: Prisma.Decimal | number | null
  notes: string | null
  lateFeeFixed: Prisma.Decimal | number
  lateFeeInterest: Prisma.Decimal | number
  lateFeeClaimedAt: Date | null
  lateFeeWaived: boolean
  _count: { lines: number }
  payments: {
    amount: Prisma.Decimal | number
    paidAt: Date
    penaltyAmount: Prisma.Decimal | number
  }[]
}

/**
 * Sole mapper from an invoice row (with `_count.lines` and `payments`) to the
 * canonical {@link InvoiceWireRow}. Every endpoint returning an invoice list
 * item routes through here so the wire shape stays byte-identical.
 *
 * Decimal-shaped columns accept either a live `Prisma.Decimal` or an
 * already-plain `number`: callers reading straight from Prisma pass the
 * former, while callers reading through a `"use cache"` boundary (which
 * strips the `Decimal` prototype) must convert to `number` before the
 * boundary and pass the latter — `decimalToNumber` handles both uniformly.
 *
 * `policy` is required rather than defaulted: the caller must resolve the
 * operator's real `UserSettings.lateFeeFixedAmount` / `lateFeeAnnualRate`
 * (via `resolveLateFeePolicy` in `@/lib/payments`) and pass it in, so
 * `lateFeeAccrued` never silently falls back to the hardcoded default
 * policy.
 *
 * @param inv - The invoice row plus its payments and line count.
 * @param policy - The operator's real late-fee policy, from `UserSettings`.
 */
export function serializeInvoice(
  inv: InvoiceRowForSerialize,
  policy: LateFeePolicy,
): InvoiceWireRow {
  const computed = getInvoiceComputed(inv, policy)
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
    lateFeeAccrued: computed.lateFeeAccrued,
    lateFeeDue: computed.lateFeeDue,
    lateFeeClaimedAt: inv.lateFeeClaimedAt
      ? inv.lateFeeClaimedAt.toISOString()
      : null,
    lateFeeWaived: inv.lateFeeWaived,
    penaltyPaid: computed.penaltyPaid,
    subtotal: decimalToNumber(inv.subtotal) ?? 0,
    tax: decimalToNumber(inv.tax) ?? 0,
    total: decimalToNumber(inv.total) ?? 0,
    totalOverride: decimalToNumber(inv.totalOverride),
    notes: inv.notes,
    linesCount: inv._count.lines,
  }
}

export interface InvoiceLateFeeRowForBreakdown {
  status: InvoiceDocStatus
  dueDate: Date
  total: Prisma.Decimal | number
  lateFeeFixed: Prisma.Decimal | number
  lateFeeInterest: Prisma.Decimal | number
  lateFeeClaimedAt: Date | null
  payments: { amount: Prisma.Decimal | number; paidAt: Date }[]
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Build the wire-shaped late-fee breakdown for one invoice's totals block.
 *
 * For an unclaimed (or waived) penalty, `fixed`/`interest`/`total` are the
 * live preview as of now, via {@link computeLateFee}. Once claimed, those
 * three are frozen to the invoice's own `lateFeeFixed`/`lateFeeInterest`
 * columns — which may be less than what accrued, since a claim can be for
 * less than the full accrued amount — while `segments` and `daysLate` are
 * recomputed with `asOf` pinned to the claim instant, so they still
 * describe how that accrual was reached rather than a live total that
 * would keep growing past the freeze.
 *
 * @param inv - The invoice's late-fee columns and payment history.
 * @param policy - The operator's real late-fee policy, from `UserSettings`.
 * @returns `null` when nothing has ever accrued and nothing was claimed.
 */
export function buildLateFeeBreakdown(
  inv: InvoiceLateFeeRowForBreakdown,
  policy: LateFeePolicy,
): InvoiceLateFeeBreakdown | null {
  const claimed = inv.lateFeeClaimedAt
    ? {
        fixed: decimalToNumber(inv.lateFeeFixed) ?? 0,
        interest: decimalToNumber(inv.lateFeeInterest) ?? 0,
      }
    : null

  const accrual = computeLateFee({
    total: decimalToNumber(inv.total) ?? 0,
    dueDate: inv.dueDate,
    status: inv.status,
    payments: inv.payments.map((p) => ({
      amount: decimalToNumber(p.amount) ?? 0,
      paidAt: p.paidAt,
    })),
    fixedAmount: policy.fixedAmount,
    annualRate: policy.annualRate,
    asOf: inv.lateFeeClaimedAt ?? new Date(),
  })

  if (accrual.total <= 0 && !claimed) return null

  const fixed = claimed ? claimed.fixed : accrual.fixed
  const interest = claimed ? claimed.interest : accrual.interest

  return {
    daysLate: accrual.daysLate,
    fixed,
    interest,
    total: round2(fixed + interest),
    segments: accrual.segments.map((s) => ({
      from: s.from.toISOString(),
      to: s.to.toISOString(),
      days: s.days,
      outstanding: s.outstanding,
      interest: s.interest,
    })),
  }
}
