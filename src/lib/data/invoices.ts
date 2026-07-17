import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"
import { serializeInvoice } from "@/domain/billing/serialize"
import type { InvoiceWireRow } from "@/domain/billing/types"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

export { serializeInvoice } from "@/domain/billing/serialize"
export type { InvoiceWireRow } from "@/domain/billing/types"

export const invoicesTag = (userId: string) => `user-${userId}-invoices`

const PAGE_SIZE = 50

/**
 * First-page cached read for /api/invoices. Tagged so all invoice mutations
 * (create, update, status change, payments, split) can invalidate via
 * `updateTag(invoicesTag(userId))`.
 */
export async function getInvoicesFirstPage(
  userId: string,
): Promise<PaginatedResponse<InvoiceWireRow>> {
  "use cache"
  cacheLife("hours")
  cacheTag(invoicesTag(userId))

  const rows = await prisma.invoice.findMany({
    where: { userId },
    orderBy: [{ issueDate: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    include: {
      _count: { select: { lines: true } },
      payments: { select: { amount: true, paidAt: true } },
    },
  })
  const hasMore = rows.length > PAGE_SIZE
  const data = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map(serializeInvoice)
  const last = data[data.length - 1]
  return {
    data,
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
  }
}
