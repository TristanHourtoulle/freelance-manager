import { NextResponse, after } from "next/server"
import { revalidateTag } from "next/cache"
import { apiUnauthorized, getAuthUser, requireSameOrigin } from "@/lib/api"
import { prisma } from "@/lib/db"
import { syncFromLinear } from "@/lib/linear"
import { createSyncRun, failSyncRun } from "@/lib/linear-sync-progress"
import { deferActivityLog } from "@/lib/activity"
import { linearProjectsTag, linearTeamsTag } from "@/lib/data/linear"
import { projectsTag } from "@/lib/data/projects"
import { navTag } from "@/lib/data/nav"

const STALE_RUN_MS = 10 * 60_000

/**
 * Trigger a Linear sync for the current user.
 *
 * The pull+write runs off the request thread via `after()`, so the client
 * receives an immediate 202 carrying the id of the `LinearSyncRun` row it can
 * then poll on `/api/linear/sync-status`. Cache revalidation and the activity
 * log fire only once the background sync has actually completed; a failure
 * there is logged, recorded on the run row, and never surfaces to the
 * (already-sent) response.
 *
 * Only one sync may run at a time per user — `syncFromLinear` is not safe to
 * run concurrently, as two passes would race on the same upserts. A RUNNING
 * row older than 10 minutes is treated as abandoned (the dyno can restart
 * mid-`after()`) and flipped to FAILED so a crash never blocks syncing forever.
 *
 * @returns 202 `{ status: "started", runId }`, 409 when a sync is already in
 * progress, or 401 when unauthenticated.
 */
export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  const running = await prisma.linearSyncRun.findFirst({
    where: { userId: user.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  })

  if (running) {
    const isStale = Date.now() - running.startedAt.getTime() > STALE_RUN_MS
    if (!isStale) {
      return NextResponse.json(
        { error: "Sync already in progress", runId: running.id },
        { status: 409 },
      )
    }
    await prisma.linearSyncRun.update({
      where: { id: running.id },
      data: {
        status: "FAILED",
        errorMessage: "Sync timed out or process restarted",
        currentLabel: null,
        finishedAt: new Date(),
      },
    })
  }

  const totalMappings = await prisma.linearMapping.count({
    where: { client: { userId: user.id } },
  })
  const runId = await createSyncRun(user.id, totalMappings)

  after(async () => {
    try {
      const result = await syncFromLinear(user.id, runId)
      revalidateTag(linearTeamsTag(user.id), "max")
      revalidateTag(linearProjectsTag(user.id), "max")
      revalidateTag(projectsTag(user.id), "max")
      revalidateTag(navTag(user.id), "max")
      deferActivityLog({
        userId: user.id,
        kind: "LINEAR_SYNCED",
        title: `Sync Linear · ${result.tasks} tasks · ${result.projects} projets`,
      })
    } catch (error) {
      console.error("[linear/refresh] background sync failed", error)
      await failSyncRun(runId, error)
    }
  })

  return NextResponse.json({ status: "started", runId }, { status: 202 })
}
