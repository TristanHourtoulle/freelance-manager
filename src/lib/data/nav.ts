import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"
import { PIPELINE_TASK_WHERE } from "@/domain/tasks/billability"

export interface NavCounts {
  clients: number
  projects: number
  tasks: number
  invoices: number
  quotes: number
}

export const navTag = (userId: string) => `user-${userId}-nav`

/**
 * Counts shown as badges next to sidebar items, cached per user.
 *
 * Tagged with `navTag(userId)` so any mutation that affects these counts
 * can invalidate via `revalidateTag(navTag(userId), 'max')` instead of
 * waiting for `cacheLife('minutes')` to elapse.
 *
 * The quotes badge counts `SENT` quotes still awaiting a decision, so a
 * `validUntil` already in the past is excluded even before the daily
 * `expire-quotes` job flips its stored status to `EXPIRED` — the badge never
 * lies during the (at most 24h) window between two cron runs.
 */
export async function getNavCounts(userId: string): Promise<NavCounts> {
  "use cache"
  cacheLife("minutes")
  cacheTag(navTag(userId))

  const now = new Date()

  const [clients, projects, tasks, invoices, quotes] = await Promise.all([
    prisma.client.count({
      where: { userId, archivedAt: null, stage: { not: "LEAD" } },
    }),
    prisma.project.count({ where: { userId, status: "ACTIVE" } }),
    prisma.task.count({ where: PIPELINE_TASK_WHERE(userId) }),
    prisma.invoice.count({
      where: {
        userId,
        status: { not: "CANCELLED" },
        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
    }),
    prisma.quote.count({
      where: {
        userId,
        status: "SENT",
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
    }),
  ])

  return { clients, projects, tasks, invoices, quotes }
}
