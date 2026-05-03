import "server-only"
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache"
import { prisma } from "@/lib/db"

export interface NavCounts {
  clients: number
  projects: number
  tasks: number
  invoices: number
}

/**
 * Counts shown as badges next to sidebar items, cached per user.
 *
 * Tagged with `user-${userId}-nav` so any mutation that affects these
 * counts can invalidate via `updateTag()` (TRI-633) instead of waiting
 * for `cacheLife('minutes')` to elapse.
 */
export async function getNavCounts(userId: string): Promise<NavCounts> {
  "use cache"
  cacheLife("minutes")
  cacheTag(`user-${userId}-nav`)

  const [clients, projects, tasks, invoices] = await Promise.all([
    prisma.client.count({ where: { userId, archivedAt: null } }),
    prisma.project.count({ where: { userId, status: "ACTIVE" } }),
    prisma.task.count({ where: { userId, status: "PENDING_INVOICE" } }),
    prisma.invoice.count({
      where: {
        userId,
        status: { not: "CANCELLED" },
        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
    }),
  ])

  return { clients, projects, tasks, invoices }
}
