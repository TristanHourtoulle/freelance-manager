import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { z } from "zod/v4"
import type { Prisma, PaymentStatus } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { computeLateFee } from "@/domain/billing/late-fee"
import { getInvoiceComputed, recomputeInvoicePayment } from "@/lib/payments"
import {
  DEFAULT_LATE_FEE_ANNUAL_RATE,
  DEFAULT_LATE_FEE_FIXED_AMOUNT,
} from "@/lib/schemas/settings"
import { deferActivityLog } from "@/lib/activity"
import { invoicesTag } from "@/lib/data/invoices"
import { navTag } from "@/lib/data/nav"

interface Params {
  params: Promise<{ id: string }>
}

const claimLateFeeBodySchema = z.object({
  fixed: z.coerce.number().min(0).max(10_000).optional(),
  interest: z.coerce.number().min(0).max(1_000_000).optional(),
})

const CAP_EPSILON = 0.005

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const LATE_FEE_INVOICE_SELECT = {
  status: true,
  dueDate: true,
  total: true,
  lateFeeFixed: true,
  lateFeeInterest: true,
  lateFeeClaimedAt: true,
  lateFeeWaived: true,
  payments: {
    select: { amount: true, paidAt: true, penaltyAmount: true },
  },
} as const

/**
 * Re-read the invoice's late-fee state after a claim/waive write and derive
 * its live `balanceDue`/`isOverdue`, using the `paymentStatus` this same
 * transaction just recomputed rather than a possibly-stale cached column.
 *
 * @param tx - The active transaction client.
 * @param id - The invoice id, already scoped to the caller by the handler.
 * @param paymentStatus - The status `recomputeInvoicePayment` just returned.
 */
async function reloadComputed(
  tx: Prisma.TransactionClient,
  id: string,
  paymentStatus: PaymentStatus,
) {
  const fresh = await tx.invoice.findUniqueOrThrow({
    where: { id },
    select: LATE_FEE_INVOICE_SELECT,
  })
  return { fresh, computed: getInvoiceComputed({ ...fresh, paymentStatus }) }
}

/**
 * Handler for `POST /api/invoices/[id]/late-fee`.
 *
 * Freezes the invoice's late-payment penalty: computes the accrued fixed
 * fee and interest via {@link computeLateFee} using the operator's real
 * `UserSettings.lateFeeFixedAmount` / `lateFeeAnnualRate`, then writes
 * `lateFeeFixed`, `lateFeeInterest`, `lateFeeClaimedAt = now()` and
 * `lateFeeWaived = false`. An optional `{ fixed, interest }` body claims
 * less than the full accrued amount — each component is capped at its own
 * accrued value, rejected with 400 above that. `recomputeInvoicePayment`
 * runs in the SAME transaction as the write, so a `paymentStatus` that was
 * cached as `PAID` is never left stale once a penalty makes the invoice owe
 * money again.
 */
export async function POST(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const { id } = await params

  try {
    const user = await getAuthUser()
    if (!user) return apiUnauthorized()

    const rawBody = await req
      .json()
      .catch(() => ({}) as Record<string, unknown>)
    const body = claimLateFeeBodySchema.parse(rawBody ?? {})

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        number: true,
        clientId: true,
        status: true,
        dueDate: true,
        total: true,
        payments: { select: { amount: true, paidAt: true } },
      },
    })
    if (!invoice) return apiNotFound()
    if (invoice.status === "CANCELLED") {
      return NextResponse.json(
        {
          error: "Impossible de réclamer une pénalité sur une facture annulée",
        },
        { status: 409 },
      )
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
      select: { lateFeeFixedAmount: true, lateFeeAnnualRate: true },
    })
    const policy = {
      fixedAmount:
        decimalToNumber(settings?.lateFeeFixedAmount) ??
        DEFAULT_LATE_FEE_FIXED_AMOUNT,
      annualRate:
        decimalToNumber(settings?.lateFeeAnnualRate) ??
        DEFAULT_LATE_FEE_ANNUAL_RATE,
    }

    const accrued = computeLateFee({
      total: Number(invoice.total),
      dueDate: invoice.dueDate,
      status: invoice.status,
      payments: invoice.payments.map((p) => ({
        amount: Number(p.amount),
        paidAt: p.paidAt,
      })),
      fixedAmount: policy.fixedAmount,
      annualRate: policy.annualRate,
      asOf: new Date(),
    })

    if (accrued.total <= 0) {
      return NextResponse.json(
        {
          error: "Aucune pénalité de retard n'est accumulée sur cette facture",
        },
        { status: 400 },
      )
    }

    const fixed = body.fixed != null ? round2(body.fixed) : accrued.fixed
    const interest =
      body.interest != null ? round2(body.interest) : accrued.interest

    if (fixed > accrued.fixed + CAP_EPSILON) {
      return NextResponse.json(
        {
          error: `L'indemnité forfaitaire réclamée (${fixed} €) dépasse le montant accumulé (${accrued.fixed} €)`,
        },
        { status: 400 },
      )
    }
    if (interest > accrued.interest + CAP_EPSILON) {
      return NextResponse.json(
        {
          error: `Les intérêts réclamés (${interest} €) dépassent le montant accumulé (${accrued.interest} €)`,
        },
        { status: 400 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: {
          lateFeeFixed: fixed,
          lateFeeInterest: interest,
          lateFeeClaimedAt: new Date(),
          lateFeeWaived: false,
        },
      })
      const paymentStatus = await recomputeInvoicePayment(id, tx)
      return { paymentStatus, ...(await reloadComputed(tx, id, paymentStatus)) }
    })

    revalidateTag(invoicesTag(user.id), "max")
    revalidateTag(navTag(user.id), "max")
    deferActivityLog({
      userId: user.id,
      kind: "LATE_FEE_CLAIMED",
      title: `Pénalité de retard de ${round2(fixed + interest).toFixed(2)} € réclamée sur ${invoice.number}`,
      clientId: invoice.clientId,
      invoiceId: invoice.id,
    })

    return NextResponse.json(
      {
        lateFeeFixed: decimalToNumber(result.fresh.lateFeeFixed) ?? 0,
        lateFeeInterest: decimalToNumber(result.fresh.lateFeeInterest) ?? 0,
        lateFeeDue: result.computed.lateFeeDue,
        lateFeeClaimedAt: result.fresh.lateFeeClaimedAt
          ? result.fresh.lateFeeClaimedAt.toISOString()
          : null,
        lateFeeWaived: result.fresh.lateFeeWaived,
        paymentStatus: result.paymentStatus,
        balanceDue: result.computed.balanceDue,
        isOverdue: result.computed.isOverdue,
      },
      { status: 201 },
    )
  } catch (error) {
    return apiServerError(error)
  }
}

/**
 * Handler for `DELETE /api/invoices/[id]/late-fee`.
 *
 * Waives a previously claimed penalty: `lateFeeWaived = true`,
 * `lateFeeFixed` / `lateFeeInterest` reset to 0, `lateFeeClaimedAt = null`,
 * then `recomputeInvoicePayment` in the same transaction so the cached
 * `paymentStatus` reflects the invoice owing only its principal again.
 */
export async function DELETE(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const { id } = await params

  try {
    const user = await getAuthUser()
    if (!user) return apiUnauthorized()

    const invoice = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
      select: { id: true, number: true, clientId: true, status: true },
    })
    if (!invoice) return apiNotFound()
    if (invoice.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Impossible de modifier une facture annulée" },
        { status: 409 },
      )
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: {
          lateFeeWaived: true,
          lateFeeFixed: 0,
          lateFeeInterest: 0,
          lateFeeClaimedAt: null,
        },
      })
      const paymentStatus = await recomputeInvoicePayment(id, tx)
      return { paymentStatus, ...(await reloadComputed(tx, id, paymentStatus)) }
    })

    revalidateTag(invoicesTag(user.id), "max")
    revalidateTag(navTag(user.id), "max")
    deferActivityLog({
      userId: user.id,
      kind: "LATE_FEE_WAIVED",
      title: `Pénalité de retard annulée sur ${invoice.number}`,
      clientId: invoice.clientId,
      invoiceId: invoice.id,
    })

    return NextResponse.json({
      lateFeeFixed: 0,
      lateFeeInterest: 0,
      lateFeeDue: 0,
      lateFeeClaimedAt: null,
      lateFeeWaived: true,
      paymentStatus: result.paymentStatus,
      balanceDue: result.computed.balanceDue,
      isOverdue: result.computed.isOverdue,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
