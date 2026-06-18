import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { actionUpdateSchema } from "@/lib/schemas/action"
import { ACTION_INCLUDE, serializeAction } from "@/lib/data/actions"
import { deferActivityLog } from "@/lib/activity"

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
    const data = actionUpdateSchema.parse(await req.json())
    const existing = await prisma.clientAction.findFirst({
      where: { id, userId: user.id },
      select: { id: true, clientId: true, status: true, title: true },
    })
    if (!existing) return apiNotFound()

    if (data.invoiceId) {
      const inv = await prisma.invoice.findFirst({
        where: {
          id: data.invoiceId,
          userId: user.id,
          clientId: existing.clientId,
        },
        select: { id: true },
      })
      if (!inv) return apiNotFound()
    }
    if (data.meetingId) {
      const m = await prisma.meeting.findFirst({
        where: {
          id: data.meetingId,
          userId: user.id,
          clientId: existing.clientId,
        },
        select: { id: true },
      })
      if (!m) return apiNotFound()
    }

    const newlyDone = data.status === "DONE" && existing.status !== "DONE"

    const updated = await prisma.clientAction.update({
      where: { id },
      data: {
        ...("type" in data ? { type: data.type } : {}),
        ...("title" in data ? { title: data.title } : {}),
        ...("link" in data ? { link: data.link ?? null } : {}),
        ...("notes" in data ? { notes: data.notes ?? null } : {}),
        ...("dueDate" in data ? { dueDate: data.dueDate ?? null } : {}),
        ...("invoiceId" in data ? { invoiceId: data.invoiceId ?? null } : {}),
        ...("meetingId" in data ? { meetingId: data.meetingId ?? null } : {}),
        ...("status" in data
          ? {
              status: data.status,
              doneAt: data.status === "DONE" ? new Date() : null,
            }
          : {}),
      },
      include: ACTION_INCLUDE,
    })

    if (newlyDone) {
      deferActivityLog({
        userId: user.id,
        kind: "ACTION_DONE",
        title: `Action « ${updated.title} » faite`,
        clientId: existing.clientId,
      })
    }
    return NextResponse.json(serializeAction(updated))
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
    const owned = await prisma.clientAction.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!owned) return apiNotFound()

    await prisma.clientAction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
