import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { meetingUpdateSchema } from "@/lib/schemas/meeting"
import { MEETING_INCLUDE, serializeMeeting } from "@/lib/data/meetings"

interface Params {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const data = meetingUpdateSchema.parse(await req.json())
    const owned = await prisma.meeting.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!owned) return apiNotFound()

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        ...("title" in data ? { title: data.title } : {}),
        ...("teamsUrl" in data ? { teamsUrl: data.teamsUrl ?? null } : {}),
        ...("heldAt" in data ? { heldAt: data.heldAt } : {}),
        ...("durationMinutes" in data
          ? { durationMinutes: data.durationMinutes ?? 0 }
          : {}),
        ...("participants" in data
          ? { participants: data.participants ?? [] }
          : {}),
        ...("agendaMd" in data ? { agendaMd: data.agendaMd ?? null } : {}),
        ...("summaryMd" in data ? { summaryMd: data.summaryMd ?? null } : {}),
      },
      include: MEETING_INCLUDE,
    })
    return NextResponse.json(serializeMeeting(updated))
  } catch (error) {
    return apiServerError(error)
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const owned = await prisma.meeting.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!owned) return apiNotFound()

    await prisma.meeting.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
