import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"

/**
 * GET /api/settings/webhook-status
 * Returns whether the Linear webhook secret is configured.
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    return NextResponse.json({
      configured: Boolean(process.env.LINEAR_WEBHOOK_SECRET),
      webhookUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/linear`
        : null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
