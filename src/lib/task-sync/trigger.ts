import "server-only"
import { after } from "next/server"
import { revalidateTag } from "next/cache"
import { deferActivityLog } from "@/lib/activity"
import { prisma } from "@/lib/db"
import { navTag } from "@/lib/data/nav"
import { projectsTag } from "@/lib/data/projects"
import type { TaskProvider } from "@/lib/task-sync/provider"
import { createSyncRun, failSyncRun } from "@/lib/task-sync/progress"
import { runTaskSync } from "@/lib/task-sync/run"

export const SYNC_STALE_RUN_MS = 10 * 60_000

export type TriggerTaskSyncResult =
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
 * Provider-neutral single-flight trigger shared by HTTP and MCP transports.
 */
export async function triggerTaskSync(
  provider: TaskProvider,
  userId: string,
): Promise<TriggerTaskSyncResult> {
  const running = await prisma.taskSyncRun.findFirst({
    where: { userId, providerId: provider.id, status: "RUNNING" },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  })

  if (running) {
    const isStale = Date.now() - running.startedAt.getTime() > SYNC_STALE_RUN_MS
    if (!isStale) return { status: "in_progress", runId: running.id }

    await prisma.taskSyncRun.update({
      where: { id: running.id },
      data: {
        status: "FAILED",
        errorMessage: "Sync timed out or process restarted",
        currentLabel: null,
        finishedAt: new Date(),
      },
    })
  }

  const totalMappings = await provider.countMappings(userId)

  let runId: string
  try {
    runId = await createSyncRun(userId, provider.id, totalMappings)
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const winner = await prisma.taskSyncRun.findFirst({
      where: { userId, providerId: provider.id, status: "RUNNING" },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    })
    return { status: "in_progress", runId: winner?.id ?? null }
  }

  after(async () => {
    try {
      const result = await runTaskSync(provider, { userId, runId })
      const tags = new Set([
        projectsTag(userId),
        navTag(userId),
        ...(provider.cacheTags?.(userId) ?? []),
      ])
      for (const tag of tags) revalidateTag(tag, "max")
      deferActivityLog({
        userId,
        kind: "TASKS_SYNCED",
        title: `Sync ${provider.displayName} · ${result.tasks} tasks · ${result.projects} projets`,
      })
    } catch (error) {
      console.error(`[task-sync/${provider.id}] background sync failed`, error)
      await failSyncRun(runId, error)
    }
  })

  return { status: "started", runId }
}
