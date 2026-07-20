import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiBadRequest,
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  getAuthUser,
  parsePagination,
  requireSameOrigin,
} from "@/lib/api"
import {
  actionCreateSchema,
  actionFilterSchema,
  clientActionStatusSchema,
  UNASSIGNED_CLIENT_FILTER,
} from "@/lib/schemas/action"
import { ACTION_INCLUDE, serializeAction } from "@/lib/data/actions"
import type { ClientActionStatus } from "@/lib/data/actions"

/**
 * Build the Prisma `status` clause from the repeated `status` query parameter.
 *
 * @param raw - Every `status` value present on the request URL.
 * @returns An empty object when no status was requested, an equality clause for
 * a single value, or an `in` clause for several.
 * @throws When a value is not a member of `ClientActionStatus`.
 */
function buildStatusWhere(raw: string[]): {
  status?: ClientActionStatus | { in: ClientActionStatus[] }
} {
  const parsed = raw
    .filter((v) => v.length > 0)
    .map((v) => clientActionStatusSchema.parse(v))
  const unique = [...new Set(parsed)]
  if (unique.length === 0) return {}
  if (unique.length === 1) return { status: unique[0] }
  return { status: { in: unique } }
}

/**
 * List follow-up actions, newest first.
 *
 * @param req - Request whose `clientId` query param accepts a client id, or
 * the `"none"` sentinel to return only unclassified (inbox) actions.
 * @returns A cursor-paginated page of serialized actions.
 */
export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const url = new URL(req.url)
    const filters = actionFilterSchema.parse({
      clientId: url.searchParams.get("clientId") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
    })
    const clientWhere =
      filters.clientId === UNASSIGNED_CLIENT_FILTER
        ? { clientId: null }
        : filters.clientId
          ? { clientId: filters.clientId }
          : {}
    const statusWhere = buildStatusWhere(url.searchParams.getAll("status"))
    const { cursor, limit } = parsePagination(req)

    const rows = await prisma.clientAction.findMany({
      where: {
        userId: user.id,
        ...clientWhere,
        ...statusWhere,
        ...(filters.type ? { type: filters.type } : {}),
      },
      include: ACTION_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const paged = buildPagedResponse(rows, limit)
    return NextResponse.json({
      data: paged.data.map(serializeAction),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const data = actionCreateSchema.parse(await req.json())

    if (!data.clientId && (data.invoiceId || data.meetingId)) {
      return apiBadRequest(
        "Un client est requis pour lier une facture ou une réunion",
      )
    }

    if (data.clientId) {
      const clientId = data.clientId
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId: user.id },
        select: { id: true },
      })
      if (!client) return apiNotFound()

      if (data.invoiceId) {
        const inv = await prisma.invoice.findFirst({
          where: { id: data.invoiceId, userId: user.id, clientId },
          select: { id: true },
        })
        if (!inv) return apiNotFound()
      }
      if (data.meetingId) {
        const m = await prisma.meeting.findFirst({
          where: { id: data.meetingId, userId: user.id, clientId },
          select: { id: true },
        })
        if (!m) return apiNotFound()
      }
    }

    const created = await prisma.clientAction.create({
      data: {
        userId: user.id,
        clientId: data.clientId ?? null,
        type: data.type ?? "OTHER",
        title: data.title,
        link: data.link ?? null,
        notes: data.notes ?? null,
        dueDate: data.dueDate ?? null,
        invoiceId: data.invoiceId ?? null,
        meetingId: data.meetingId ?? null,
      },
      include: ACTION_INCLUDE,
    })
    return NextResponse.json(serializeAction(created), { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
