import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

export interface ProjectWireRow {
  id: string
  clientId: string
  client: {
    id: string
    firstName: string
    lastName: string
    company: string | null
    color: string | null
  }
  linearProjectId: string | null
  linearTeamId: string | null
  name: string
  key: string
  description: string | null
  status: "ACTIVE" | "PAUSED" | "COMPLETED"
  tasksTotal: number
}

export const projectsTag = (userId: string) => `user-${userId}-projects`

const PAGE_SIZE = 50

/**
 * First-page (no cursor, default limit) cached read for /api/projects.
 * Tagged so project mutations and Linear sync invalidate via
 * `updateTag(projectsTag(userId))`.
 */
export async function getProjectsFirstPage(
  userId: string,
): Promise<PaginatedResponse<ProjectWireRow>> {
  "use cache"
  cacheLife("hours")
  cacheTag(projectsTag(userId))

  const rows = await prisma.project.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          color: true,
        },
      },
      _count: { select: { tasks: true } },
    },
  })
  const hasMore = rows.length > PAGE_SIZE
  const data = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map((p) => ({
    id: p.id,
    clientId: p.clientId,
    client: p.client,
    linearProjectId: p.linearProjectId,
    linearTeamId: p.linearTeamId,
    name: p.name,
    key: p.key,
    description: p.description,
    status: p.status,
    tasksTotal: p._count.tasks,
  }))
  const last = data[data.length - 1]
  return {
    data,
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
  }
}
