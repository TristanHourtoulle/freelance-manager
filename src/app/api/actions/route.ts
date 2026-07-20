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
  UNASSIGNED_CLIENT_FILTER,
} from "@/lib/schemas/action"
import {
  ACTION_INCLUDE,
  serializeAction,
  type ClientActionStatus,
  type ClientActionType,
} from "@/lib/data/actions"

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
    const clientIdParam = url.searchParams.get("clientId") ?? undefined
    const clientWhere =
      clientIdParam === UNASSIGNED_CLIENT_FILTER
        ? { clientId: null }
        : clientIdParam
          ? { clientId: clientIdParam }
          : {}
    const status =
      (url.searchParams.get("status") as ClientActionStatus | null) ?? undefined
    const type =
      (url.searchParams.get("type") as ClientActionType | null) ?? undefined
    const { cursor, limit } = parsePagination(req)

    const rows = await prisma.clientAction.findMany({
      where: {
        userId: user.id,
        ...clientWhere,
        ...(status ? { status } : {}),
        ...(type ? { type } : {}),
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
