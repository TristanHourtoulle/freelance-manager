import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { clearLinearCaches, getLinearSyncStatus } from "@/lib/linear-service"
import { NextResponse } from "next/server"

/**
 * POST /api/linear/refresh
 * Clears all Linear caches to force a fresh data fetch on next request.
 * @returns 200 - `{ clearedAt, lastSyncAt, lastWebhookReceivedAt }`
 * @throws 401 - Unauthenticated request
 */
export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    clearLinearCaches()

    return NextResponse.json({
      clearedAt: Date.now(),
      ...getLinearSyncStatus(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
