import "server-only"
import { z } from "zod/v4"
import { isSyncStale } from "@/lib/sync-staleness"

/**
 * Freshness fields attached to every MCP read tool whose data is a
 * manually-pulled Linear mirror (`list_tasks`, `list_projects`,
 * `get_dashboard`), so the model can tell stale data apart from a real
 * empty result instead of only discovering the problem by retrying.
 */
export interface SyncFreshness {
  lastSyncedAt: string | null
  syncStale: boolean
  syncAgeMinutes: number | null
}

/**
 * Zod shape for {@link SyncFreshness}, spread into a tool's `outputSchema`.
 */
export const syncFreshnessOutputShape = {
  lastSyncedAt: z
    .string()
    .nullable()
    .describe(
      "ISO timestamp of the last successful Linear sync, null if this " +
        "user has never synced.",
    ),
  syncStale: z
    .boolean()
    .describe(
      "True when the last sync is old enough that this data may be out " +
        "of date (see sync-staleness threshold). When true, call " +
        "trigger_linear_sync before relying on these results for anything " +
        "time-sensitive.",
    ),
  syncAgeMinutes: z
    .number()
    .int()
    .nullable()
    .describe(
      "Minutes since the last successful sync, null if never synced. " +
        "Given directly so the model does not need to do its own date math.",
    ),
}

/**
 * Compute the freshness fields for a Linear-mirrored read tool response.
 *
 * @param lastSyncedAt - `UserSettings.linearLastSyncedAt`, null if the user
 *   has never run a Linear sync.
 * @param now - Reference instant, defaults to the current time (injectable
 *   for deterministic tests).
 * @returns The ISO timestamp (or null), the `isSyncStale` verdict, and the
 *   age in whole minutes.
 */
export function computeSyncFreshness(
  lastSyncedAt: Date | null | undefined,
  now: Date = new Date(),
): SyncFreshness {
  return {
    lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    syncStale: isSyncStale(lastSyncedAt, now.getTime()),
    syncAgeMinutes: lastSyncedAt
      ? Math.round((now.getTime() - lastSyncedAt.getTime()) / 60_000)
      : null,
  }
}
