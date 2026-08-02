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

export async function createSyncRun(
  userId: string,
  providerId: string,
  totalMappings: number,
): Promise<string> {
  const run = await prisma.taskSyncRun.create({
    data: { userId, providerId, totalMappings, status: "RUNNING" },
    select: { id: true },
  })
  return run.id
}

export async function touchSyncRun(
  runId: string | null | undefined,
  args: TouchSyncRunArgs,
): Promise<void> {
  if (!runId) return
  try {
    await prisma.taskSyncRun.update({
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
    console.error("[task-sync-progress] touch failed", error)
  }
}

export async function completeSyncRun(
  runId: string | null | undefined,
  args: CompleteSyncRunArgs,
): Promise<void> {
  if (!runId) return
  try {
    await prisma.taskSyncRun.update({
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
    console.error("[task-sync-progress] complete failed", error)
  }
}

export async function failSyncRun(
  runId: string | null | undefined,
  error: unknown,
): Promise<void> {
  if (!runId) return
  const errorMessage =
    error instanceof Error ? error.message.slice(0, 500) : "Sync failed"
  try {
    await prisma.taskSyncRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        errorMessage,
        currentLabel: null,
        finishedAt: new Date(),
      },
    })
  } catch (progressError) {
    console.error("[task-sync-progress] fail failed", progressError)
  }
}
