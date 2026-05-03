import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  decimalToNumber,
  getAuthUser,
  parsePagination,
} from "@/lib/api"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const url = new URL(req.url)
    const clientId = url.searchParams.get("clientId") ?? undefined
    const projectId = url.searchParams.get("projectId") ?? undefined
    const status = url.searchParams.get("status") ?? undefined
    const { cursor, limit } = parsePagination(req)

    const rows = await prisma.task.findMany({
      where: {
        userId: user.id,
        ...(clientId ? { clientId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(status
          ? {
              status: status as
                | "PENDING_INVOICE"
                | "DONE"
                | "IN_PROGRESS"
                | "BACKLOG"
                | "CANCELED",
            }
          : {
              status: {
                in: ["PENDING_INVOICE", "DONE", "IN_PROGRESS", "BACKLOG"],
              },
            }),
      },
      orderBy: [
        { projectId: "asc" },
        { linearIdentifier: "asc" },
        { id: "asc" },
      ],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        linearIssueId: true,
        linearIdentifier: true,
        title: true,
        status: true,
        priority: true,
        estimate: true,
        completedAt: true,
        invoiceId: true,
        clientId: true,
        projectId: true,
      },
    })

    const paged = buildPagedResponse(rows, limit)
    return NextResponse.json({
      data: paged.data.map((t) => ({
        id: t.id,
        linearIssueId: t.linearIssueId,
        linearIdentifier: t.linearIdentifier,
        title: t.title,
        status: t.status,
        priority: t.priority,
        estimate: decimalToNumber(t.estimate),
        completedAt: t.completedAt?.toISOString() ?? null,
        invoiceId: t.invoiceId,
        clientId: t.clientId,
        projectId: t.projectId,
      })),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
