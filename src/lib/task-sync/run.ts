import "server-only"
import type { TaskProvider, TaskSyncResult } from "@/lib/task-sync/provider"
import { completeSyncRun, touchSyncRun } from "@/lib/task-sync/progress"

interface RunTaskSyncOptions {
  userId: string
  runId?: string | null
}

/** Run any task provider while keeping progress persistence provider-agnostic. */
export async function runTaskSync(
  provider: TaskProvider,
  { userId, runId }: RunTaskSyncOptions,
): Promise<TaskSyncResult> {
  const result = await provider.sync({
    userId,
    reportProgress: (progress) => touchSyncRun(runId, progress),
  })

  await completeSyncRun(runId, {
    projectsUpserted: result.projects,
    tasksUpserted: result.tasks,
  })

  return result
}
