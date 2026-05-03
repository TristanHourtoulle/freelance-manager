import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  getAuthUser,
  parsePagination,
} from "@/lib/api"

/**
 * GET /api/linear-mappings
 * Returns every LinearMapping owned by the current user (across all clients),
 * enriched with the linked client's display name. Used by the linking modal
 * to know whether a Linear project is already attached to *another* client
 * (and forbid double-linking).
 */
export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const { cursor, limit } = parsePagination(req)
    const rows = await prisma.linearMapping.findMany({
      where: { client: { userId: user.id } },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const paged = buildPagedResponse(rows, limit)
    return NextResponse.json({
      data: paged.data.map((m) => ({
        id: m.id,
        clientId: m.clientId,
        clientLabel:
          m.client.company ?? `${m.client.firstName} ${m.client.lastName}`,
        linearTeamId: m.linearTeamId,
        linearProjectId: m.linearProjectId,
      })),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
