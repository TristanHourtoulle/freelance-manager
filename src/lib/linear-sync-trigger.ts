import "server-only"
import { after } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import { syncFromLinear } from "@/lib/linear"
import { createSyncRun, failSyncRun } from "@/lib/linear-sync-progress"
import { deferActivityLog } from "@/lib/activity"
import { linearProjectsTag, linearTeamsTag } from "@/lib/data/linear"
import { projectsTag } from "@/lib/data/projects"
import { navTag } from "@/lib/data/nav"

/**
 * A `RUNNING` run older than this is treated as abandoned (the dyno can
 * restart mid-`after()`) and flipped to `FAILED` before a new run starts.
 */
export const SYNC_STALE_RUN_MS = 10 * 60_000

/**
 * Outcome of {@link triggerLinearSync}: either a fresh run was created, or an
 * existing `RUNNING` run (this user's, possibly on another instance) already
 * owns the single-flight slot.
 */
export type TriggerLinearSyncResult =
  | { status: "started"; runId: string }
  | { status: "in_progress"; runId: string | null }

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

/**
 * Start a Linear sync for a user, or report that one is already running.
 *
 * This is the ONE place that owns the single-flight guard, the stale-run
 * takeover, background scheduling via `after()`, and the cache
 * revalidation set — both `POST /api/linear/refresh` and the
 * `trigger_linear_sync` MCP tool call this instead of each other, so the
 * concurrency-sensitive logic (including the P2002 fallback for the
 * partial unique index on `("userId") WHERE status = 'RUNNING'`) exists
 * exactly once. Callers layer their own transport-specific concerns
 * (CSRF checks, cooldown, response shaping) on top.
 *
 * `after()` requires an active request context; this function must
 * therefore only be called synchronously from within a Route Handler
 * (both current callers qualify — the refresh route itself, and the MCP
 * tool invoked from inside `POST /mcp`'s `transport.handleRequest`).
 *
 * The pull+write runs off the request thread via `after()`. Cache
 * revalidation and the activity log fire only once the background sync has
 * actually completed; a failure there is logged, recorded on the run row,
 * and never surfaces to the (already-returned) result.
 *
 * A `RUNNING` row older than {@link SYNC_STALE_RUN_MS} is treated as
 * abandoned and flipped to `FAILED` *before* the new row is inserted, so
 * the zombie never collides with it under the unique index.
 *
 * @param userId - Owner of the sync to trigger.
 * @returns `{ status: "started", runId }` for the newly created run, or
 *   `{ status: "in_progress", runId }` when a `RUNNING` run already owns
 *   the single-flight slot (`runId` is null only in the P2002 race edge
 *   case where the winning run already finished by the time it is looked
 *   up again).
 */
export async function triggerLinearSync(
  userId: string,
): Promise<TriggerLinearSyncResult> {
  const running = await prisma.linearSyncRun.findFirst({
    where: { userId, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  })

  if (running) {
    const isStale = Date.now() - running.startedAt.getTime() > SYNC_STALE_RUN_MS
    if (!isStale) return { status: "in_progress", runId: running.id }

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
    where: { client: { userId } },
  })

  let runId: string
  try {
    runId = await createSyncRun(userId, totalMappings)
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const winner = await prisma.linearSyncRun.findFirst({
      where: { userId, status: "RUNNING" },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    })
    return { status: "in_progress", runId: winner?.id ?? null }
  }

  after(async () => {
    try {
      const result = await syncFromLinear(userId, runId)
      revalidateTag(linearTeamsTag(userId), "max")
      revalidateTag(linearProjectsTag(userId), "max")
      revalidateTag(projectsTag(userId), "max")
      revalidateTag(navTag(userId), "max")
      deferActivityLog({
        userId,
        kind: "LINEAR_SYNCED",
        title: `Sync Linear · ${result.tasks} tasks · ${result.projects} projets`,
      })
    } catch (error) {
      console.error("[linear-sync-trigger] background sync failed", error)
      await failSyncRun(runId, error)
    }
  })

  return { status: "started", runId }
}
