import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * GET /api/health
 * Public liveness check. Anonymous callers (or callers with a wrong
 * X-Health-Key header) get only `{ ok: true | false }` to avoid leaking
 * deploy fingerprint info. Callers presenting a valid X-Health-Key get the
 * full payload (uptime, version, per-service checks). When HEALTH_KEY is
 * unset, every caller is treated as anonymous.
 * @returns 200 - DB reachable
 * @returns 503 - DB unreachable
 */
export async function GET(request: Request) {
  let dbHealthy = true

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbHealthy = false
  }

  const status = dbHealthy ? 200 : 503
  const expected = process.env.HEALTH_KEY
  const provided = request.headers.get("x-health-key")
  const detailed = Boolean(
    expected && provided && constantTimeEquals(expected, provided),
  )

  if (!detailed) {
    return NextResponse.json({ ok: dbHealthy }, { status })
  }

  return NextResponse.json(
    {
      ok: dbHealthy,
      status: dbHealthy ? "healthy" : "unhealthy",
      checks: {
        database: dbHealthy ? "connected" : "disconnected",
        linearWebhook: "unknown",
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
    },
    { status },
  )
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
