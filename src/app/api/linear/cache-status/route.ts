import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { getLinearSyncStatus } from "@/lib/linear-service"
import { NextResponse } from "next/server"

/**
 * GET /api/linear/cache-status
 * Returns the current Linear sync status (last sync time, last webhook received time).
 * @returns 200 - `{ lastSyncAt, lastWebhookReceivedAt }`
 * @throws 401 - Unauthenticated request
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    return NextResponse.json(getLinearSyncStatus())
  } catch (error) {
    return handleApiError(error)
  }
}
