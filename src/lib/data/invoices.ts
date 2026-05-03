import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import { getInvoiceComputed } from "@/lib/payments"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

export const invoicesTag = (userId: string) => `user-${userId}-invoices`

export interface InvoiceWireRow {
  id: string
  number: string
  clientId: string
  projectId: string | null
  status: "DRAFT" | "SENT" | "CANCELLED"
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERPAID"
  isOverdue: boolean
  kind: "STANDARD" | "DEPOSIT"
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

import type { Prisma } from "@/generated/prisma/client"

interface InvoiceWithCountAndPayments {
  id: string
  number: string
  clientId: string
  projectId: string | null
  status: "DRAFT" | "SENT" | "CANCELLED"
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERPAID"
  kind: "STANDARD" | "DEPOSIT"
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

export function serializeInvoice(
  inv: InvoiceWithCountAndPayments,
): InvoiceWireRow {
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
