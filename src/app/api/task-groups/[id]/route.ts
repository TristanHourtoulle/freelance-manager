import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { taskGroupUpdateSchema } from "@/lib/schemas/task-group"
import { taskGroupsTag } from "@/lib/data/task-groups"

interface Params {
  params: Promise<{ id: string }>
}

class TaskGroupConflictError extends Error {}

function conflict(code = "TASKS_NOT_GROUPABLE") {
  return NextResponse.json(
    { error: "Ce groupe ne peut pas être modifié", code },
    { status: 409 },
  )
}

async function ownedGroup(id: string, userId: string) {
  return prisma.taskGroup.findFirst({
    where: { id, userId },
    select: { id: true, clientId: true, invoiceId: true },
  })
}

export async function PATCH(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const group = await ownedGroup(id, user.id)
    if (!group) return apiNotFound()
    if (group.invoiceId) return conflict("TASK_GROUP_ALREADY_INVOICED")
    const data = taskGroupUpdateSchema.parse(await req.json())

    await prisma.$transaction(async (tx) => {
      const editable = await tx.taskGroup.updateMany({
        where: { id, userId: user.id, invoiceId: null },
        data: { name: data.name },
      })
      if (editable.count !== 1) throw new TaskGroupConflictError()

      const tasks = await tx.task.findMany({
        where: {
          id: { in: data.taskIds },
          userId: user.id,
          clientId: group.clientId,
          status: "PENDING_INVOICE",
          billable: true,
          invoiceId: null,
          OR: [{ taskGroupId: null }, { taskGroupId: id }],
        },
        select: { id: true },
      })
      if (tasks.length !== data.taskIds.length) {
        throw new TaskGroupConflictError()
      }

      await tx.task.updateMany({
        where: { taskGroupId: id, userId: user.id },
        data: { taskGroupId: null },
      })
      const claimed = await tx.task.updateMany({
        where: {
          id: { in: data.taskIds },
          userId: user.id,
          clientId: group.clientId,
          invoiceId: null,
          taskGroupId: null,
        },
        data: { taskGroupId: id },
      })
      if (claimed.count !== data.taskIds.length) {
        throw new TaskGroupConflictError()
      }
    })

    revalidateTag(taskGroupsTag(user.id), "max")
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof TaskGroupConflictError) return conflict()
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
    const group = await ownedGroup(id, user.id)
    if (!group) return apiNotFound()
    if (group.invoiceId) return conflict("TASK_GROUP_ALREADY_INVOICED")

    await prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { taskGroupId: id, userId: user.id },
        data: { taskGroupId: null },
      })
      const deleted = await tx.taskGroup.deleteMany({
        where: { id, userId: user.id, invoiceId: null },
      })
      if (deleted.count !== 1) throw new TaskGroupConflictError()
    })

    revalidateTag(taskGroupsTag(user.id), "max")
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof TaskGroupConflictError) return conflict()
    return apiServerError(error)
  }
}
