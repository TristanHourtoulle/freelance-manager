import type { Prisma } from "@/generated/prisma/client"
import { effortDaysForTask } from "@/domain/analytics/effective-rate"

type DecimalLike = Prisma.Decimal | number

export type ClientCategoryKey =
  | "FREELANCE"
  | "STUDY"
  | "PERSONAL"
  | "SIDE_PROJECT"

export interface CategoryMixClient {
  id: string
  category: ClientCategoryKey
}

export interface CategoryMixTask {
  clientId: string
  estimate: DecimalLike | null
  actualDays: DecimalLike | null
}

export interface CategoryMixRow {
  category: ClientCategoryKey
  taskCount: number
  days: number
  revenue: number
}

/**
 * Breakdown of effort, task count and revenue by client category.
 *
 * Reports the mix; deliberately does not exclude non-FREELANCE effort from any
 * existing denominator, which would silently change a displayed metric.
 */
export interface CategoryMix {
  rows: CategoryMixRow[]
  totalDays: number
  nonFreelanceDaysShare: number | null
}

/**
 * Group the period's tasks and revenue by the owning client's category.
 *
 * Tasks whose client is absent from `clients` are ignored — the analytics
 * client query excludes archived clients.
 *
 * @param clients - Active clients with their category.
 * @param tasks - Period-scoped task rows carrying the effort columns.
 * @param revenueByClient - Revenue already aggregated per client, server-side.
 * @returns One row per category present in the data (sorted by days descending,
 *   ties broken by category ascending), the global effort total, and the share
 *   of effort spent outside FREELANCE work (`null` when no effort is recorded).
 */
export function buildCategoryMix(
  clients: readonly CategoryMixClient[],
  tasks: readonly CategoryMixTask[],
  revenueByClient: ReadonlyMap<string, number>,
): CategoryMix {
  const categoryByClient = new Map<string, ClientCategoryKey>(
    clients.map((c) => [c.id, c.category]),
  )

  const acc = new Map<ClientCategoryKey, CategoryMixRow>()
  const ensure = (category: ClientCategoryKey): CategoryMixRow => {
    const existing = acc.get(category)
    if (existing) return existing
    const created: CategoryMixRow = {
      category,
      taskCount: 0,
      days: 0,
      revenue: 0,
    }
    acc.set(category, created)
    return created
  }

  for (const task of tasks) {
    const category = categoryByClient.get(task.clientId)
    if (!category) continue
    const row = ensure(category)
    row.taskCount += 1
    const days = effortDaysForTask(task)
    if (days !== null && Number.isFinite(days)) row.days += days
  }

  for (const client of clients) {
    const revenue = revenueByClient.get(client.id) ?? 0
    if (revenue === 0) continue
    const row = ensure(client.category)
    row.revenue += Number.isFinite(revenue) ? revenue : 0
  }

  const rows = [...acc.values()].sort((a, b) => {
    if (a.days !== b.days) return b.days - a.days
    return a.category < b.category ? -1 : a.category > b.category ? 1 : 0
  })

  const totalDays = rows.reduce((sum, row) => sum + row.days, 0)
  const freelanceDays =
    rows.find((row) => row.category === "FREELANCE")?.days ?? 0
  const nonFreelanceDaysShare =
    totalDays > 0 ? (totalDays - freelanceDays) / totalDays : null

  return { rows, totalDays, nonFreelanceDaysShare }
}
