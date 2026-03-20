import { prisma } from "@/lib/db"
import { apiError, handleApiError } from "@/lib/api-utils"
import { computeAllNotifications } from "@/lib/notification-service"
import { NextResponse } from "next/server"

/** Verifies the cron secret and returns an error response if invalid. */
function verifyCronSecret(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET environment variable is not configured")
    return apiError("CRON_NOT_CONFIGURED", "Cron secret is not configured", 500)
  }

  const authHeader = request.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  if (token !== cronSecret) {
    return apiError("CRON_UNAUTHORIZED", "Invalid cron secret", 401)
  }

  return null
}

/** Runs notification computation for all users and returns a summary. */
async function runNotificationCron(): Promise<NextResponse> {
  const users = await prisma.user.findMany({
    select: { id: true },
  })

  const results = await Promise.allSettled(
    users.map((user) => computeAllNotifications(user.id)),
  )

  const succeeded = results.filter((r) => r.status === "fulfilled").length
  const failed = results.filter((r) => r.status === "rejected").length

  return NextResponse.json({
    processed: users.length,
    succeeded,
    failed,
    timestamp: new Date().toISOString(),
  })
}

/**
 * GET /api/cron/notifications
 * Vercel Cron endpoint that computes notifications for all users.
 * Secured via CRON_SECRET env var checked against the Authorization header.
 *
 * @returns 200 - Summary of processed users
 * @throws 401 - Missing or invalid CRON_SECRET
 */
export async function GET(request: Request) {
  try {
    const authError = verifyCronSecret(request)
    if (authError) return authError

    return await runNotificationCron()
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/cron/notifications
 * Alternative method for external cron services that prefer POST.
 * Same behavior as GET.
 */
export async function POST(request: Request) {
  try {
    const authError = verifyCronSecret(request)
    if (authError) return authError

    return await runNotificationCron()
  } catch (error) {
    return handleApiError(error)
  }
}
