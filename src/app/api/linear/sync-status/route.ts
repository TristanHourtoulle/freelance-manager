import { getTaskSyncStatus } from "@/lib/task-sync/http"

/** @deprecated Prefer GET /api/task-sync/linear/sync-status. */
export function GET() {
  return getTaskSyncStatus("linear")
}
