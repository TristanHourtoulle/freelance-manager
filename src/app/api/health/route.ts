import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

/**
 * GET /api/health
 * Returns application health status with individual service checks.
 * @returns 200 - All critical services healthy
 * @returns 503 - One or more critical services unhealthy
 */
export async function GET() {
  const checks: Record<string, string> = {}
  let healthy = true

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = "connected"
  } catch {
    checks.database = "disconnected"
    healthy = false
  }

  checks.linearWebhook = "unknown"

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
    },
    { status: healthy ? 200 : 503 },
  )
}
