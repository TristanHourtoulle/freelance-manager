import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"
import { serializeClient } from "@/domain/clients/serialize"
import {
  buildClientsBillableSummary,
  type BillableGroupRow,
  type ClientsBillableSummary,
} from "@/domain/clients/billable"
import {
  buildClientsRecencySummary,
  type ClientsRecencySummary,
} from "@/domain/clients/recency"
import type { ClientWireRow } from "@/domain/clients/types"
import type { BillingMode } from "@/generated/prisma/client"
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

interface BillableSqlRow {
  clientId: string
  billingMode: BillingMode
  rate: number
  taskCount: number
  estimateDays: number
}

/**
 * Global "à facturer" aggregate for every client of a user.
 *
 * Deliberately uncached and computed by a single grouped query: it folds task
 * rows, so it must never be capped by the clients/tasks page size nor served
 * from the hour-long clients cache, which no task mutation invalidates.
 *
 * @param userId - Owner of the clients and tasks.
 * @returns Per-client billable count/value plus the global totals.
 */
export async function getClientsBillableSummary(
  userId: string,
): Promise<ClientsBillableSummary> {
  const rows = await prisma.$queryRaw<BillableSqlRow[]>`
    SELECT t."clientId"                              AS "clientId",
           c."billingMode"::text                     AS "billingMode",
           c."rate"::float                           AS "rate",
           COUNT(*)::int                             AS "taskCount",
           COALESCE(SUM(COALESCE(t."estimate", 1)), 0)::float AS "estimateDays"
    FROM tasks t
    JOIN clients c ON c.id = t."clientId"
    WHERE t."userId" = ${userId}
      AND t.status = 'PENDING_INVOICE'
      AND t."invoiceId" IS NULL
    GROUP BY t."clientId", c."billingMode", c."rate"
  `
  const groups: BillableGroupRow[] = rows.map((r) => ({
    clientId: r.clientId,
    billingMode: r.billingMode,
    rate: Number(r.rate),
    taskCount: Number(r.taskCount),
    estimateDays: Number(r.estimateDays),
  }))
  return buildClientsBillableSummary(groups)
}

interface RecencySqlRow {
  clientId: string
  lastContactAt: Date
}

/**
 * Last-contact timestamp per client, across activity logs, meetings and
 * completed tasks.
 *
 * Deliberately uncached and computed by a single grouped query: it folds rows
 * from three tables that no client mutation touches, so it must never be capped
 * by the clients page size nor served from the hour-long clients cache.
 *
 * @param userId - Owner of the clients and their interactions.
 * @returns Per-client last contact, silence duration and silence verdict.
 */
export async function getClientsRecencySummary(
  userId: string,
): Promise<ClientsRecencySummary> {
  const rows = await prisma.$queryRaw<RecencySqlRow[]>`
    SELECT s."clientId" AS "clientId", MAX(s.ts) AS "lastContactAt"
    FROM (
      SELECT a."clientId" AS "clientId", a."createdAt" AS ts
      FROM activity_log a
      WHERE a."userId" = ${userId} AND a."clientId" IS NOT NULL
      UNION ALL
      SELECT m."clientId", m."heldAt" FROM meetings m WHERE m."userId" = ${userId}
      UNION ALL
      SELECT t."clientId", t."completedAt" FROM tasks t
      WHERE t."userId" = ${userId} AND t."completedAt" IS NOT NULL
    ) s
    GROUP BY s."clientId"
  `
  return buildClientsRecencySummary(rows, new Date())
}
