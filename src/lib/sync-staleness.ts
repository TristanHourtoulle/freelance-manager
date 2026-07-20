/**
 * Age past which the last Linear sync is considered stale. Sync is pull-only
 * and manual, so nothing refreshes the cache on its own: after a day without a
 * run, the numbers on screen can no longer be trusted as current.
 */
export const SYNC_STALE_AFTER_MS = 24 * 60 * 60 * 1000

/** French label shown by the staleness affordance. */
export const SYNC_STALE_LABEL = "Sync ancienne"

/**
 * Tell whether the last Linear sync is old enough to warrant a warning.
 *
 * @param lastSyncedAt Timestamp of the last successful sync, `null` if never.
 * @param now Reference instant in ms, defaults to the current time.
 * @returns `true` when never synced, or synced more than
 *   `SYNC_STALE_AFTER_MS` ago. Unparsable input is treated as stale.
 */
export function isSyncStale(
  lastSyncedAt: string | Date | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!lastSyncedAt) return true
  const at =
    lastSyncedAt instanceof Date ? lastSyncedAt : new Date(lastSyncedAt)
  const ms = at.getTime()
  if (Number.isNaN(ms)) return true
  return now - ms > SYNC_STALE_AFTER_MS
}
