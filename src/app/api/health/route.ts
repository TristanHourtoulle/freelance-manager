import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"

/**
 * GET /api/health
 * Checks database connectivity and returns application health status.
 * @returns 200 - `{ status: "healthy", database: "connected" }`
 * @returns 503 - `{ status: "unhealthy", database: "disconnected" }`
 */
export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1")

    return NextResponse.json({
      status: "healthy",
      database: "connected",
    })
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
      },
      { status: 503 },
    )
  }
}
