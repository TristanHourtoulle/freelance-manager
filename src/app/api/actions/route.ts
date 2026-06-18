import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  getAuthUser,
  parsePagination,
  requireSameOrigin,
} from "@/lib/api"
import { actionCreateSchema } from "@/lib/schemas/action"
import {
  ACTION_INCLUDE,
  serializeAction,
  type ClientActionStatus,
  type ClientActionType,
} from "@/lib/data/actions"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const url = new URL(req.url)
    const clientId = url.searchParams.get("clientId") ?? undefined
    const status =
      (url.searchParams.get("status") as ClientActionStatus | null) ?? undefined
    const type =
      (url.searchParams.get("type") as ClientActionType | null) ?? undefined
    const { cursor, limit } = parsePagination(req)

    const rows = await prisma.clientAction.findMany({
      where: {
        userId: user.id,
        ...(clientId ? { clientId } : {}),
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

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id },
      select: { id: true },
    })
    if (!client) return apiNotFound()

    if (data.invoiceId) {
      const inv = await prisma.invoice.findFirst({
        where: { id: data.invoiceId, userId: user.id, clientId: data.clientId },
        select: { id: true },
      })
      if (!inv) return apiNotFound()
    }
    if (data.meetingId) {
      const m = await prisma.meeting.findFirst({
        where: { id: data.meetingId, userId: user.id, clientId: data.clientId },
        select: { id: true },
      })
      if (!m) return apiNotFound()
    }

    const created = await prisma.clientAction.create({
      data: {
        userId: user.id,
        clientId: data.clientId,
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
