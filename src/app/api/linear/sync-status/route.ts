import { NextResponse } from "next/server"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"
import { prisma } from "@/lib/db"

/**
 * Read the current user's latest Linear sync run.
 *
 * The run is always resolved server-side from the session user — a
 * client-supplied run id is never accepted, since the `userId` clause is the
 * only boundary keeping one user's sync state out of another's poll response.
 *
 * @returns 200 with the latest run DTO, 200 `{ status: "idle" }` when the user
 * has never synced, or 401 when unauthenticated.
 */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const run = await prisma.linearSyncRun.findFirst({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        totalMappings: true,
        doneMappings: true,
        currentLabel: true,
        projectsUpserted: true,
        tasksUpserted: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
      },
    })

    if (!run) return NextResponse.json({ status: "idle" })

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      totalMappings: run.totalMappings,
      doneMappings: run.doneMappings,
      currentLabel: run.currentLabel,
      projectsUpserted: run.projectsUpserted,
      tasksUpserted: run.tasksUpserted,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
