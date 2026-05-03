import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

export interface ClientWireRow {
  id: string
  firstName: string
  lastName: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  billingMode: "DAILY" | "FIXED" | "HOURLY"
  rate: number
  fixedPrice: number | null
  deposit: number | null
  paymentTerms: number | null
  category: "FREELANCE" | "STUDY" | "PERSONAL" | "SIDE_PROJECT"
  color: string | null
  starred: boolean
  archived: boolean
  createdAt: string
}

export const clientsTag = (userId: string) => `user-${userId}-clients`

const PAGE_SIZE = 50

/**
 * First-page (no cursor, default limit) cached read for /api/clients.
 *
 * Subsequent pages bypass the cache — the cursor space would otherwise
 * blow up the cache directory. Tagged so any client-table mutation can
 * invalidate via `updateTag(clientsTag(userId))`.
 */
export async function getClientsFirstPage(
  userId: string,
): Promise<PaginatedResponse<ClientWireRow>> {
  "use cache"
  cacheLife("hours")
  cacheTag(clientsTag(userId))

  const rows = await prisma.client.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
  })
  const hasMore = rows.length > PAGE_SIZE
  const data = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map(serializeClient)
  const last = data[data.length - 1]
  return {
    data,
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
  }
}

export function serializeClient(c: {
  id: string
  firstName: string
  lastName: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  billingMode: "DAILY" | "FIXED" | "HOURLY"
  rate: import("@/generated/prisma/client").Prisma.Decimal
  fixedPrice: import("@/generated/prisma/client").Prisma.Decimal | null
  deposit: import("@/generated/prisma/client").Prisma.Decimal | null
  paymentTerms: number | null
  category: "FREELANCE" | "STUDY" | "PERSONAL" | "SIDE_PROJECT"
  color: string | null
  starred: boolean
  archivedAt: Date | null
  createdAt: Date
}): ClientWireRow {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    email: c.email,
    phone: c.phone,
    website: c.website,
    address: c.address,
    notes: c.notes,
    billingMode: c.billingMode,
    rate: decimalToNumber(c.rate) ?? 0,
    fixedPrice: decimalToNumber(c.fixedPrice),
    deposit: decimalToNumber(c.deposit),
    paymentTerms: c.paymentTerms,
    category: c.category,
    color: c.color,
    starred: c.starred,
    archived: c.archivedAt != null,
    createdAt: c.createdAt.toISOString(),
  }
}
