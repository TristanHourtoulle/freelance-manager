import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
} from "@/lib/api"

interface Params {
  params: Promise<{ id: string }>
}

/**
 * DELETE /api/projects/[id]
 *
 * Unlinks a Linear project from the user's account: removes the local Project
 * row (which cascades to tasks) AND deletes any matching LinearMapping rows
 * referencing the same `linearProjectId` for the same client. This makes the
 * unlink stick across future syncs.
 *
 * Tasks that were already invoiced keep their invoice but lose their project
 * link (Task.projectId is NOT cascadeable from project delete because tasks
 * cascade on project delete — they go away too).
 *
 * NOTE: invoices created from those tasks are preserved. The InvoiceLine.taskId
 * is set to null because of the SetNull on Task delete.
 */
export async function DELETE(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
      select: { id: true, clientId: true, linearProjectId: true },
    })
    if (!project) return apiNotFound()

    await prisma.$transaction([
      prisma.linearMapping.deleteMany({
        where: {
          clientId: project.clientId,
          linearProjectId: project.linearProjectId,
        },
      }),
      prisma.project.delete({ where: { id: project.id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
