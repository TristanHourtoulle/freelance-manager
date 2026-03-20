import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError, apiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

const metricSchema = z.object({
  event: z.string().min(1).max(100),
  page: z.string().max(200).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const PERIOD_MAP: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
}

/**
 * POST /api/metrics
 * Records a usage metric event for the authenticated user.
 */
export async function POST(request: Request) {
  try {
    const userOrRes = await getAuthenticatedUser(request)
    if (userOrRes instanceof NextResponse) return userOrRes

    const body: unknown = await request.json()
    const data = metricSchema.parse(body)

    await prisma.usageMetric.create({
      data: {
        userId: userOrRes.id,
        event: data.event,
        page: data.page ?? null,
        metadata: (data.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/metrics?period=7d|30d|90d
 * Returns aggregated usage metrics for the authenticated user.
 */
export async function GET(request: Request) {
  try {
    const userOrRes = await getAuthenticatedUser(request)
    if (userOrRes instanceof NextResponse) return userOrRes

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") ?? "30d"
    const days = PERIOD_MAP[period]

    if (!days) {
      return apiError(
        "VAL_INVALID_PERIOD",
        "Invalid period. Use 7d, 30d, or 90d.",
        400,
      )
    }

    const since = new Date()
    since.setDate(since.getDate() - days)

    const metrics = await prisma.usageMetric.findMany({
      where: {
        userId: userOrRes.id,
        createdAt: { gte: since },
      },
      select: {
        event: true,
        page: true,
      },
    })

    // Aggregate event counts
    const eventCounts: Record<string, number> = {}
    const pageCounts: Record<string, number> = {}

    for (const metric of metrics) {
      eventCounts[metric.event] = (eventCounts[metric.event] ?? 0) + 1
      if (metric.page) {
        pageCounts[metric.page] = (pageCounts[metric.page] ?? 0) + 1
      }
    }

    // Top pages sorted by count descending
    const topPages = Object.entries(pageCounts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return NextResponse.json({
      totalEvents: metrics.length,
      eventCounts,
      topPages,
      period,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
