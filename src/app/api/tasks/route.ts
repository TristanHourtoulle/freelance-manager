import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  decimalToNumber,
  getAuthUser,
  parsePagination,
  parseSearchQuery,
} from "@/lib/api"
import { taskBillableQuerySchema } from "@/lib/schemas/task"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const url = new URL(req.url)
    const clientId = url.searchParams.get("clientId") ?? undefined
    const projectId = url.searchParams.get("projectId") ?? undefined
    const status = url.searchParams.get("status") ?? undefined
    const billableParam = url.searchParams.get("billable")
    const billable =
      billableParam === null
        ? undefined
        : taskBillableQuerySchema.parse(billableParam)
    const { cursor, limit } = parsePagination(req)
    const q = parseSearchQuery(req)

    const rows = await prisma.task.findMany({
      where: {
        userId: user.id,
        ...(clientId ? { clientId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(billable === undefined ? {} : { billable }),
        ...(q
          ? {
              OR: [
                {
                  linearIdentifier: {
                    contains: q,
                    mode: "insensitive" as const,
                  },
                },
                { title: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
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
        linearUrl: true,
        title: true,
        status: true,
        priority: true,
        estimate: true,
        actualDays: true,
        completedAt: true,
        invoiceId: true,
        clientId: true,
        projectId: true,
        billable: true,
        nonBillableReason: true,
        nonBillableNote: true,
      },
    })

    const paged = buildPagedResponse(rows, limit)
    return NextResponse.json({
      data: paged.data.map((t) => ({
        id: t.id,
        linearIssueId: t.linearIssueId,
        linearIdentifier: t.linearIdentifier,
        linearUrl: t.linearUrl,
        title: t.title,
        status: t.status,
        priority: t.priority,
        estimate: decimalToNumber(t.estimate),
        actualDays: decimalToNumber(t.actualDays),
        completedAt: t.completedAt?.toISOString() ?? null,
        invoiceId: t.invoiceId,
        clientId: t.clientId,
        projectId: t.projectId,
        billable: t.billable,
        nonBillableReason: t.nonBillableReason,
        nonBillableNote: t.nonBillableNote,
      })),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
