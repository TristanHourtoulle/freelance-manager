import "server-only"
import { prisma } from "@/lib/db"

interface TouchSyncRunArgs {
  doneMappings?: number
  currentLabel?: string | null
}

interface CompleteSyncRunArgs {
  projectsUpserted: number
  tasksUpserted: number
}

/**
 * Open a new RUNNING sync run for a user.
 *
 * @param userId - Owner of the run.
 * @param totalMappings - How many Linear mappings the sync will walk through.
 * @returns The id of the freshly created run row.
 */
export async function createSyncRun(
  userId: string,
  totalMappings: number,
): Promise<string> {
  const run = await prisma.linearSyncRun.create({
    data: { userId, totalMappings, status: "RUNNING" },
    select: { id: true },
  })
  return run.id
}

/**
 * Record incremental progress on a run.
 *
 * Deliberately best-effort: progress rows are UX metadata, never financial
 * truth, so a failed write is logged and swallowed rather than aborting the
 * sync that is reporting it (same philosophy as `deferActivityLog`).
 *
 * @param runId - Run to update; a nullish id is a no-op.
 * @param args - Partial progress fields to persist.
 */
export async function touchSyncRun(
  runId: string | null | undefined,
  args: TouchSyncRunArgs,
): Promise<void> {
  if (!runId) return
  try {
    await prisma.linearSyncRun.update({
      where: { id: runId },
      data: {
        ...(args.doneMappings !== undefined
          ? { doneMappings: args.doneMappings }
          : {}),
        ...(args.currentLabel !== undefined
          ? { currentLabel: args.currentLabel }
          : {}),
      },
    })
  } catch (error) {
    console.error("[linear-sync-progress] touch failed", error)
  }
}

/**
 * Mark a run COMPLETED with its final counters.
 *
 * @param runId - Run to close; a nullish id is a no-op.
 * @param args - Final upsert counts reported by the sync.
 */
export async function completeSyncRun(
  runId: string | null | undefined,
  args: CompleteSyncRunArgs,
): Promise<void> {
  if (!runId) return
  try {
    await prisma.linearSyncRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        projectsUpserted: args.projectsUpserted,
        tasksUpserted: args.tasksUpserted,
        currentLabel: null,
        finishedAt: new Date(),
      },
    })
  } catch (error) {
    console.error("[linear-sync-progress] complete failed", error)
  }
}

/**
 * Mark a run FAILED with a short, sanitized message.
 *
 * Only `error.message` is stored, truncated to 500 chars — a serialized Linear
 * SDK error can embed the outgoing request headers, which carry the API token.
 *
 * @param runId - Run to close; a nullish id is a no-op.
 * @param error - The thrown value; non-Error values fall back to a generic message.
 */
export async function failSyncRun(
  runId: string | null | undefined,
  error: unknown,
): Promise<void> {
  if (!runId) return
  const errorMessage =
    error instanceof Error ? error.message.slice(0, 500) : "Sync failed"
  try {
    await prisma.linearSyncRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        errorMessage,
        currentLabel: null,
        finishedAt: new Date(),
      },
    })
  } catch (err) {
    console.error("[linear-sync-progress] fail failed", err)
  }
}
