import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

import type { Prisma } from "@/generated/prisma/client"

const auditLogFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  action: z.string().optional(),
  entity: z.string().optional(),
})

/**
 * GET /api/audit-logs
 * Returns paginated audit logs for the authenticated user.
 */
export async function GET(request: Request) {
  try {
    const rl = rateLimit(request)
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

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const filters = auditLogFilterSchema.parse(params)

    const where: Prisma.AuditLogWhereInput = {
      userId: userOrError.id,
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entity ? { entity: filters.entity } : {}),
    }

    const skip = (filters.page - 1) * filters.limit

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ])

    return NextResponse.json({
      items,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
