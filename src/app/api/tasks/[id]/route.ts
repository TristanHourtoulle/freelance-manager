import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { taskUpdateSchema } from "@/lib/schemas/task"

interface Params {
  params: Promise<{ id: string }>
}

/**
 * Update the freelancer-owned fields of a Linear-mirrored task.
 *
 * Only `actualDays` (real effort spent) is writable — every other column is
 * owned by the Linear sync and would be overwritten on the next pull.
 *
 * @param req - The incoming request; must be same-origin.
 * @param params - Route params carrying the task id.
 * @returns The updated task projection, 401/403/404 otherwise.
 */
export async function PATCH(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const data = taskUpdateSchema.parse(await req.json())
    const owned = await prisma.task.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!owned) return apiNotFound()

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...("actualDays" in data
          ? { actualDays: data.actualDays ?? null }
          : {}),
      },
      select: {
        id: true,
        linearIssueId: true,
        linearIdentifier: true,
        title: true,
        status: true,
        priority: true,
        estimate: true,
        actualDays: true,
        completedAt: true,
        invoiceId: true,
        clientId: true,
        projectId: true,
      },
    })

    return NextResponse.json({
      id: updated.id,
      linearIssueId: updated.linearIssueId,
      linearIdentifier: updated.linearIdentifier,
      title: updated.title,
      status: updated.status,
      priority: updated.priority,
      estimate: decimalToNumber(updated.estimate),
      actualDays: decimalToNumber(updated.actualDays),
      completedAt: updated.completedAt?.toISOString() ?? null,
      invoiceId: updated.invoiceId,
      clientId: updated.clientId,
      projectId: updated.projectId,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
