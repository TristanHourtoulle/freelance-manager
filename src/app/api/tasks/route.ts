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
import {
  taskCountsQuerySchema,
  taskIdListParamSchema,
} from "@/domain/tasks/counts"
import { getTaskCountsSummary } from "@/lib/data/tasks"

function parseIdListParam(url: URL, param: string): string[] | undefined {
  const raw = url.searchParams.get(param)
  if (raw === null) return undefined
  return taskIdListParamSchema.parse(raw)
}

/**
 * Task list (default) and chip-count aggregate (`?summary=status`) endpoint.
 *
 * Multi-select narrowing uses one comma-separated query param per dimension —
 * `clientIds=c1,c2&projectIds=p1` — shared by both modes so the list and the
 * counts can never disagree. A single value is a one-element list. An absent
 * or empty param means "no narrowing" (all rows), never "match nothing".
 * Lists longer than 200 ids are rejected with a 400.
 *
 * @param req - The incoming request.
 * @returns The paginated task list, or the counts summary in aggregate mode.
 */
export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const url = new URL(req.url)
    const summaryParam = url.searchParams.get("summary")
    if (summaryParam !== null) {
      const parsed = taskCountsQuerySchema.parse({
        summary: summaryParam,
        clientIds: url.searchParams.get("clientIds") ?? undefined,
        projectIds: url.searchParams.get("projectIds") ?? undefined,
      })
      const counts = await getTaskCountsSummary(user.id, {
        clientIds: parsed.clientIds,
        projectIds: parsed.projectIds,
      })
      return NextResponse.json(counts)
    }
    const clientIds = parseIdListParam(url, "clientIds")
    const projectIds = parseIdListParam(url, "projectIds")
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
        ...(clientIds && clientIds.length > 0
          ? { clientId: { in: clientIds } }
          : {}),
        ...(projectIds && projectIds.length > 0
          ? { projectId: { in: projectIds } }
          : {}),
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
        taskGroupId: true,
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
        taskGroupId: t.taskGroupId,
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
