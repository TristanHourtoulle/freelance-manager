import "server-only"
import { prisma } from "@/lib/db"
import { syncLinearTasks } from "@/lib/linear"
import { linearProjectsTag, linearTeamsTag } from "@/lib/data/linear"
import type { TaskProvider } from "@/lib/task-sync/provider"

/** Linear adapter for the integration-neutral task synchronization contract. */
export const linearTaskProvider: TaskProvider = {
  id: "linear",
  displayName: "Linear",
  countMappings: (userId) =>
    prisma.linearMapping.count({ where: { client: { userId } } }),
  sync: ({ userId, reportProgress }) => syncLinearTasks(userId, reportProgress),
  cacheTags: (userId) => [linearTeamsTag(userId), linearProjectsTag(userId)],
}
