import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import {
  serializeInvoice,
  type InvoiceRowForSerialize,
} from "@/domain/billing/serialize"
import type { LateFeePolicy } from "@/lib/payments"
import type { InvoiceWireRow } from "@/domain/billing/types"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

export { serializeInvoice } from "@/domain/billing/serialize"
export type { InvoiceWireRow } from "@/domain/billing/types"

export const invoicesTag = (userId: string) => `user-${userId}-invoices`

const PAGE_SIZE = 50

/**
 * Cached DB read backing {@link getInvoicesFirstPage}. Tagged so all invoice
 * mutations (create, update, status change, payments, split) can invalidate
 * via `updateTag(invoicesTag(userId))`.
 *
 * Deliberately returns plain-number rows rather than serialized wire rows:
 * `serializeInvoice` derives `lateFeeAccrued` from the operator's late-fee
 * policy (`UserSettings.lateFeeFixedAmount` / `lateFeeAnnualRate`), which a
 * `"use cache"` function cannot pick up without becoming part of the cache
 * key — and even keyed on policy, the cached preview would only refresh on
 * the `cacheLife("hours")` schedule, not the moment a claim or a payment
 * changes what is owed. Caching the DB rows and serializing with the live
 * policy on every call keeps the query cheap without risking a stale
 * accrual figure.
 *
 * Every `Prisma.Decimal` column is converted to a plain `number` *inside*
 * this function, before the row ever crosses back out through the
 * `"use cache"` boundary: that boundary serializes its return value and
 * strips the `Decimal` prototype, so a `Decimal` that escaped unconverted
 * would come out the other side as a plain object with no `.toNumber()` —
 * silently breaking every caller downstream (see the regression this
 * fixes). `Date` values are left as-is; unlike `Decimal`, `Date` survives
 * the cache boundary's serialization intact.
 *
 * @param userId - The invoice owner.
 * @returns Up to `PAGE_SIZE + 1` rows (the extra row signals `hasMore`),
 *   pre-converted to plain numbers so the payload is always cache-safe.
 */
export async function findInvoicesFirstPageRows(
  userId: string,
): Promise<InvoiceRowForSerialize[]> {
  "use cache"
  cacheLife("hours")
  cacheTag(invoicesTag(userId))

  const rows = await prisma.invoice.findMany({
    where: { userId },
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    include: {
      _count: { select: { lines: true } },
      payments: {
        select: { amount: true, paidAt: true, penaltyAmount: true },
      },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    clientId: row.clientId,
    projectId: row.projectId,
    status: row.status,
    paymentStatus: row.paymentStatus,
    kind: row.kind,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    subtotal: decimalToNumber(row.subtotal) ?? 0,
    tax: decimalToNumber(row.tax) ?? 0,
    total: decimalToNumber(row.total) ?? 0,
    totalOverride: decimalToNumber(row.totalOverride),
    notes: row.notes,
    lateFeeFixed: decimalToNumber(row.lateFeeFixed) ?? 0,
    lateFeeInterest: decimalToNumber(row.lateFeeInterest) ?? 0,
    lateFeeClaimedAt: row.lateFeeClaimedAt,
    lateFeeWaived: row.lateFeeWaived,
    _count: row._count,
    payments: row.payments.map((p) => ({
      amount: decimalToNumber(p.amount) ?? 0,
      paidAt: p.paidAt,
      penaltyAmount: decimalToNumber(p.penaltyAmount) ?? 0,
    })),
  }))
}

/**
 * First-page read for `GET /api/invoices`. The underlying rows are cached
 * (see {@link findInvoicesFirstPageRows}); serialization — and therefore
 * the live `lateFeeAccrued` preview — always runs against the `policy`
 * passed in by the caller, so it reflects the operator's current
 * `UserSettings` on every request even while the row cache is warm.
 *
 * @param userId - The invoice owner.
 * @param policy - The operator's real late-fee policy, from `UserSettings`.
 */
export async function getInvoicesFirstPage(
  userId: string,
  policy: LateFeePolicy,
): Promise<PaginatedResponse<InvoiceWireRow>> {
  const rows = await findInvoicesFirstPageRows(userId)
  const hasMore = rows.length > PAGE_SIZE
  const data = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map((row) =>
    serializeInvoice(row, policy),
  )
  const last = data[data.length - 1]
  return {
    data,
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
  }
}
