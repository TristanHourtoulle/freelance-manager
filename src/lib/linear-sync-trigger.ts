import "server-only"
import { linearTaskProvider } from "@/lib/task-providers/linear"
import {
  SYNC_STALE_RUN_MS,
  triggerTaskSync,
  type TriggerTaskSyncResult,
} from "@/lib/task-sync/trigger"

export { SYNC_STALE_RUN_MS }

/** @deprecated Prefer `TriggerTaskSyncResult` for provider-agnostic code. */
export type TriggerLinearSyncResult = TriggerTaskSyncResult

/**
 * Compatibility entry point used by the existing Linear MCP tools.
 * Provider-independent orchestration lives in `triggerTaskSync`.
 */
export function triggerLinearSync(
  userId: string,
): Promise<TriggerLinearSyncResult> {
  return triggerTaskSync(linearTaskProvider, userId)
}
