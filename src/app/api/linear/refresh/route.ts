import { NextResponse } from "next/server"
import { apiUnauthorized, getAuthUser, requireSameOrigin } from "@/lib/api"
import { triggerLinearSync } from "@/lib/linear-sync-trigger"

function syncInProgress(runId: string | null) {
  return NextResponse.json(
    { error: "Sync already in progress", ...(runId ? { runId } : {}) },
    { status: 409 },
  )
}

/**
 * Trigger a Linear sync for the current user.
 *
 * All the concurrency-sensitive work — the single-flight guard, the
 * stale-run takeover, scheduling the pull+write via `after()`, and the
 * cache revalidation set — lives in {@link triggerLinearSync}, shared with
 * the `trigger_linear_sync` MCP tool so that logic exists exactly once.
 * This route only adds the two things specific to a browser-originated
 * request: the CSRF/session check, and mapping the shared result onto an
 * HTTP status code.
 *
 * @returns 202 `{ status: "started", runId }`, 409 when a sync is already in
 * progress, or 401 when unauthenticated.
 */
export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  const result = await triggerLinearSync(user.id)
  if (result.status === "in_progress") {
    return syncInProgress(result.runId)
  }
  return NextResponse.json({ status: "started", runId: result.runId }, { status: 202 })
}
