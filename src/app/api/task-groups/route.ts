import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import {
  taskGroupCreateSchema,
  taskGroupListSchema,
} from "@/lib/schemas/task-group"
import { serializeTaskGroup } from "@/domain/task-groups/serialize"
import { taskGroupsTag } from "@/lib/data/task-groups"

const taskSelect = {
  id: true,
  linearIdentifier: true,
  linearUrl: true,
  title: true,
  estimate: true,
  clientId: true,
  projectId: true,
} as const

class TaskGroupConflictError extends Error {}

function conflict() {
  return NextResponse.json(
    {
      error: "Certaines tasks ne peuvent pas rejoindre ce groupe",
      code: "TASKS_NOT_GROUPABLE",
    },
    { status: 409 },
  )
}

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const url = new URL(req.url)
    const filters = taskGroupListSchema.parse({
      clientId: url.searchParams.get("clientId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    })
    const groups = await prisma.taskGroup.findMany({
      where: {
        userId: user.id,
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.status === "pending"
          ? { invoiceId: null }
          : filters.status === "invoiced"
            ? { invoiceId: { not: null } }
            : {}),
      },
      include: {
        invoice: { select: { number: true } },
        tasks: {
          select: taskSelect,
          orderBy: [{ projectId: "asc" }, { linearIdentifier: "asc" }],
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    })

    return NextResponse.json(groups.map(serializeTaskGroup))
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
    const data = taskGroupCreateSchema.parse(await req.json())
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id },
      select: { id: true },
    })
    if (!client) return apiUnauthorized()

    const created = await prisma.$transaction(async (tx) => {
      const tasks = await tx.task.findMany({
        where: {
          id: { in: data.taskIds },
          userId: user.id,
          clientId: data.clientId,
          status: "PENDING_INVOICE",
          billable: true,
          invoiceId: null,
          taskGroupId: null,
        },
        select: taskSelect,
        orderBy: [{ projectId: "asc" }, { linearIdentifier: "asc" }],
      })
      if (tasks.length !== data.taskIds.length) {
        throw new TaskGroupConflictError()
      }

      const group = await tx.taskGroup.create({
        data: {
          userId: user.id,
          clientId: data.clientId,
          name: data.name,
        },
      })
      const claimed = await tx.task.updateMany({
        where: {
          id: { in: data.taskIds },
          userId: user.id,
          clientId: data.clientId,
          invoiceId: null,
          taskGroupId: null,
        },
        data: { taskGroupId: group.id },
      })
      if (claimed.count !== data.taskIds.length) {
        throw new TaskGroupConflictError()
      }

      return { ...group, invoice: null, tasks }
    })

    revalidateTag(taskGroupsTag(user.id), "max")
    return NextResponse.json(serializeTaskGroup(created), { status: 201 })
  } catch (error) {
    if (error instanceof TaskGroupConflictError) return conflict()
    return apiServerError(error)
  }
}
