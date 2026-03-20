import { prisma } from "@/lib/db"
import { apiError, handleApiError } from "@/lib/api-utils"
import { computeAllNotifications } from "@/lib/notification-service"
import { NextResponse } from "next/server"

/**
 * GET /api/cron/notifications
 * Vercel Cron endpoint that computes notifications for all users.
 * Secured via CRON_SECRET env var checked against the Authorization header.
 *
 * @returns 200 - Summary of processed users and errors
 * @throws 401 - Missing or invalid CRON_SECRET
 * @throws 500 - Internal error
 */
export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.error("[Cron] CRON_SECRET environment variable is not configured")
      return apiError(
        "CRON_NOT_CONFIGURED",
        "Cron secret is not configured",
        500,
      )
    }

    const authHeader = request.headers.get("authorization")
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

    if (token !== cronSecret) {
      return apiError("CRON_UNAUTHORIZED", "Invalid cron secret", 401)
    }

    const users = await prisma.user.findMany({
      select: { id: true, email: true },
    })

    const results: Array<{
      userId: string
      status: "success" | "error"
      error?: string
    }> = []

    for (const user of users) {
      try {
        await computeAllNotifications(user.id)
        results.push({ userId: user.id, status: "success" })
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        console.error(
          `[Cron] Failed to compute notifications for user ${user.id}:`,
          error,
        )
        results.push({ userId: user.id, status: "error", error: message })
      }
    }

    const successCount = results.filter((r) => r.status === "success").length
    const errorCount = results.filter((r) => r.status === "error").length

    return NextResponse.json({
      processed: users.length,
      success: successCount,
      errors: errorCount,
      details: results,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
