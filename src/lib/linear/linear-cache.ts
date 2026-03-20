import { TTLCache } from "@/lib/cache"
import { env } from "@/lib/env"
import type {
  LinearTeamDTO,
  LinearProjectDTO,
  LinearIssueDTO,
  LinearMemberDTO,
  LinearWorkflowStateDTO,
  LinearIssueLabelDTO,
} from "./linear-types"

const BASE_TTL_MS = (env.LINEAR_CACHE_TTL_SECONDS ?? 300) * 1000
const TEAMS_TTL = BASE_TTL_MS * 2
const PROJECTS_TTL = BASE_TTL_MS
const ISSUES_TTL = Math.max(Math.round(BASE_TTL_MS * 0.4), 60_000)

export const teamsCache = new TTLCache<LinearTeamDTO[]>(TEAMS_TTL)
export const projectsCache = new TTLCache<LinearProjectDTO[]>(PROJECTS_TTL)
export const issuesCache = new TTLCache<LinearIssueDTO[]>(ISSUES_TTL)
export const membersCache = new TTLCache<LinearMemberDTO[]>(TEAMS_TTL)
export const statesCache = new TTLCache<LinearWorkflowStateDTO[]>(TEAMS_TTL)
export const labelsCache = new TTLCache<LinearIssueLabelDTO[]>(TEAMS_TTL)

export { BASE_TTL_MS }

let lastSyncedAt: number | null = null
let lastWebhookReceivedAt: number | null = null

/**
 * Records the timestamp of the most recent Linear webhook event.
 *
 * @param timestamp - Unix timestamp in milliseconds
 */
export function setLastWebhookReceivedAt(timestamp: number): void {
  lastWebhookReceivedAt = timestamp
}

/** Updates the lastSyncedAt timestamp to now. */
export function markSynced(): void {
  lastSyncedAt = Date.now()
}

/** Clears all in-memory Linear caches (teams, projects, issues). */
export function clearLinearCaches(): void {
  teamsCache.clear()
  projectsCache.clear()
  issuesCache.clear()
  membersCache.clear()
  statesCache.clear()
  labelsCache.clear()
}

/**
 * Returns the current Linear sync status including staleness detection.
 *
 * @returns Object with lastSyncedAt timestamp, lastWebhookReceivedAt timestamp, and isStale flag
 */
export function getLinearSyncStatus(): {
  lastSyncedAt: number | null
  lastWebhookReceivedAt: number | null
  isStale: boolean
} {
  const isStale =
    lastSyncedAt === null || Date.now() - lastSyncedAt > BASE_TTL_MS
  return { lastSyncedAt, lastWebhookReceivedAt, isStale }
}
