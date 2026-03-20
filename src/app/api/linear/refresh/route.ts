import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { clearLinearCaches, getLinearSyncStatus } from "@/lib/linear-service"
import { dashboardCache } from "@/lib/dashboard-cache"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

/**
 * POST /api/linear/refresh
 * Clears all Linear caches to force a fresh data fetch on next request.
 * Also invalidates the dashboard cache for the user.
 * @returns 200 - `{ clearedAt, lastSyncAt, lastWebhookReceivedAt }`
 * @throws 401 - Unauthenticated request
 */
export async function POST(request: Request) {
  try {
    const rl = rateLimit(request, { limit: 30, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        {
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.reset / 1000)) },
        },
      )
    }

    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    clearLinearCaches()
    dashboardCache.delete(`dashboard:${userOrError.id}`)

    return NextResponse.json({
      clearedAt: Date.now(),
      ...getLinearSyncStatus(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
