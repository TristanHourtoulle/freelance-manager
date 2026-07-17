import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"
import { serializeClient } from "@/domain/clients/serialize"
import type { ClientWireRow } from "@/domain/clients/types"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

export { serializeClient } from "@/domain/clients/serialize"
export type { ClientWireRow } from "@/domain/clients/types"

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
