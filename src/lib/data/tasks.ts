import "server-only"
import { prisma } from "@/lib/db"
import {
  buildTaskCountsSummary,
  type TaskCountsAggregateRow,
  type TaskCountsQuery,
  type TaskCountsSummary,
} from "@/domain/tasks/counts"

/**
 * Uncapped Tasks-page chip counts, computed by the database in one round trip.
 *
 * Deliberately uncached and folded by a single `COUNT(*) FILTER` aggregate:
 * the figures must never be capped by the 50-row task page size, so they are
 * counted server-side instead of folding fetched rows. The whole aggregate is
 * scoped to the page's visible status universe (`PENDING_INVOICE`, `DONE`,
 * `IN_PROGRESS`, `BACKLOG`), mirroring the default list query, so `invoiced`
 * and `non_billable` never count `CANCELED` rows the page cannot show.
 *
 * `pending` implements the chip semantics (every `PENDING_INVOICE` row under
 * the active filters), not the "À facturer" pipeline gate of
 * `getClientsBillableSummary`, which additionally requires uninvoiced +
 * billable + active FREELANCE client — see {@link TaskCountsSummary}.
 *
 * @param userId - Owner of the tasks; every count is scoped to this user.
 * @param filters - Optional client / project narrowing from the page filters.
 * @returns The normalized chip counts, including `unestimatedCount`.
 */
export async function getTaskCountsSummary(
  userId: string,
  filters: TaskCountsQuery = {},
): Promise<TaskCountsSummary> {
  const clientId = filters.clientId ?? null
  const projectId = filters.projectId ?? null
  const rows = await prisma.$queryRaw<TaskCountsAggregateRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE t."status" IN ('PENDING_INVOICE', 'DONE', 'IN_PROGRESS'))::int AS "all",
      COUNT(*) FILTER (WHERE t."status" = 'PENDING_INVOICE')::int             AS "pending",
      COUNT(*) FILTER (WHERE t."status" = 'DONE')::int                        AS "done",
      COUNT(*) FILTER (WHERE t."status" = 'IN_PROGRESS')::int                 AS "inProgress",
      COUNT(*) FILTER (WHERE t."invoiceId" IS NOT NULL)::int                  AS "invoiced",
      COUNT(*) FILTER (WHERE t."billable" = false)::int                       AS "nonBillable",
      COUNT(*) FILTER (WHERE t."status" = 'PENDING_INVOICE'
                         AND t."billable" = true
                         AND t."invoiceId" IS NULL
                         AND t."estimate" IS NULL)::int                       AS "unestimated"
    FROM tasks t
    WHERE t."userId" = ${userId}
      AND t."status" IN ('PENDING_INVOICE', 'DONE', 'IN_PROGRESS', 'BACKLOG')
      AND (${clientId}::text IS NULL OR t."clientId" = ${clientId})
      AND (${projectId}::text IS NULL OR t."projectId" = ${projectId})
  `
  return buildTaskCountsSummary(rows[0])
}
