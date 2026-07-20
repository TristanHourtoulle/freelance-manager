import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  getAuthUser,
  parsePagination,
  parseSearchQuery,
} from "@/lib/api"
import { attachProjectRisk, getProjectsFirstPage } from "@/lib/data/projects"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const { cursor, limit } = parsePagination(req)
    const q = parseSearchQuery(req)
    if (!cursor && limit === 50 && !q) {
      return NextResponse.json(await getProjectsFirstPage(user.id))
    }
    const rows = await prisma.project.findMany({
      where: {
        userId: user.id,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { key: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
    const paged = buildPagedResponse(rows, limit)
    const riskById = await attachProjectRisk(user.id, paged.data)
    return NextResponse.json({
      data: paged.data.map((p) => ({
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
      })),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
