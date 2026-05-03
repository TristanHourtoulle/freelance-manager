import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  getAuthUser,
  parsePagination,
} from "@/lib/api"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const { cursor, limit } = parsePagination(req)
    const rows = await prisma.project.findMany({
      where: { userId: user.id },
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
      })),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
