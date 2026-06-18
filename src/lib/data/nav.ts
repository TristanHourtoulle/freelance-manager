import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"

export interface NavCounts {
  clients: number
  projects: number
  tasks: number
  invoices: number
}

export const navTag = (userId: string) => `user-${userId}-nav`

/**
 * Counts shown as badges next to sidebar items, cached per user.
 *
 * Tagged with `navTag(userId)` so any mutation that affects these counts
 * can invalidate via `revalidateTag(navTag(userId), 'max')` instead of
 * waiting for `cacheLife('minutes')` to elapse.
 */
export async function getNavCounts(userId: string): Promise<NavCounts> {
  "use cache"
  cacheLife("minutes")
  cacheTag(navTag(userId))

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
