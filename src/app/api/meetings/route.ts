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
import { meetingCreateSchema } from "@/lib/schemas/meeting"
import { MEETING_INCLUDE, serializeMeeting } from "@/lib/data/meetings"
import { deferActivityLog } from "@/lib/activity"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const url = new URL(req.url)
    const clientId = url.searchParams.get("clientId") ?? undefined
    const { cursor, limit } = parsePagination(req)

    const rows = await prisma.meeting.findMany({
      where: { userId: user.id, ...(clientId ? { clientId } : {}) },
      include: MEETING_INCLUDE,
      orderBy: [{ heldAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const paged = buildPagedResponse(rows, limit)
    return NextResponse.json({
      data: paged.data.map(serializeMeeting),
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
    const data = meetingCreateSchema.parse(await req.json())

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id },
      select: { id: true },
    })
    if (!client) return apiNotFound()

    const created = await prisma.meeting.create({
      data: {
        userId: user.id,
        clientId: data.clientId,
        title: data.title,
        teamsUrl: data.teamsUrl ?? null,
        heldAt: data.heldAt,
        durationMinutes: data.durationMinutes ?? 0,
        participants: data.participants ?? [],
        agendaMd: data.agendaMd ?? null,
        summaryMd: data.summaryMd ?? null,
      },
      include: MEETING_INCLUDE,
    })
    deferActivityLog({
      userId: user.id,
      kind: "MEETING_LOGGED",
      title: `Réunion « ${created.title} » consignée`,
      clientId: created.clientId,
    })
    return NextResponse.json(serializeMeeting(created), { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
