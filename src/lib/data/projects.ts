import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import {
  clampWorkingDaysPerWeek,
  deriveAtRisk,
} from "@/domain/capacity/workload"
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
  targetDate: string | null
  remainingDays: number
  atRisk: boolean
}

export interface ProjectRiskInput {
  id: string
  targetDate: Date | null
}

export interface ProjectRiskFields {
  targetDate: string | null
  remainingDays: number
  atRisk: boolean
}

/**
 * Derive the schedule-risk fields for a page of projects.
 *
 * Shared by the cached first page and the uncached cursor/search path so the
 * two can never diverge. Remaining work sums the `estimate` of the project's
 * open tasks only.
 *
 * @param userId - Owner of the projects.
 * @param projects - The already-paginated project rows.
 * @returns A map from project id to its wire-ready risk fields.
 */
export async function attachProjectRisk(
  userId: string,
  projects: readonly ProjectRiskInput[],
): Promise<Map<string, ProjectRiskFields>> {
  const projectIds = projects.map((p) => p.id)
  const [effortByProject, settingsRow] = await Promise.all([
    projectIds.length > 0
      ? prisma.task.groupBy({
          by: ["projectId"],
          where: {
            userId,
            projectId: { in: projectIds },
            status: { in: ["BACKLOG", "IN_PROGRESS"] },
          },
          _sum: { estimate: true },
        })
      : Promise.resolve([]),
    prisma.userSettings.findUnique({
      where: { userId },
      select: { workingDaysPerWeek: true },
    }),
  ])

  const daysByProject = new Map(
    effortByProject.map((row) => [
      row.projectId,
      decimalToNumber(row._sum.estimate) ?? 0,
    ]),
  )
  const workingDaysPerWeek = clampWorkingDaysPerWeek(
    settingsRow?.workingDaysPerWeek,
  )
  const now = new Date()

  return new Map(
    projects.map((p) => {
      const remainingDays = daysByProject.get(p.id) ?? 0
      return [
        p.id,
        {
          targetDate: p.targetDate?.toISOString() ?? null,
          remainingDays,
          atRisk: deriveAtRisk({
            remainingDays,
            targetDate: p.targetDate,
            now,
            workingDaysPerWeek,
          }),
        },
      ]
    }),
  )
}

export const projectsTag = (userId: string) => `user-${userId}-projects`

const PAGE_SIZE = 50

/**
 * First-page (no cursor, default limit) cached read for /api/projects.
 * Tagged so project mutations and Linear sync invalidate via
 * `updateTag(projectsTag(userId))`.
 *
 * `atRisk` is evaluated at cache-fill time and this entry is `cacheLife("hours")`,
 * so the flag can lag reality by up to an hour — acceptable at day granularity.
 *
 * @param userId - Owner of the projects.
 * @returns The first page of project wire rows.
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
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
  const riskById = await attachProjectRisk(userId, page)
  const data = page.map((p) => ({
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
    targetDate: riskById.get(p.id)?.targetDate ?? null,
    remainingDays: riskById.get(p.id)?.remainingDays ?? 0,
    atRisk: riskById.get(p.id)?.atRisk ?? false,
  }))
  const last = data[data.length - 1]
  return {
    data,
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
  }
}
