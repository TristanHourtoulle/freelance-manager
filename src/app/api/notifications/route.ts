import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { computeAllNotifications } from "@/lib/notification-service"
import { notificationFilterSchema } from "@/lib/schemas/notification"

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const filters = notificationFilterSchema.parse({
      unreadOnly: url.searchParams.get("unreadOnly") ?? "true",
      type: url.searchParams.get("type") ?? undefined,
      limit: url.searchParams.get("limit") ?? "20",
    })

    await computeAllNotifications(userOrError.id)

    const where: Record<string, unknown> = {
      userId: userOrError.id,
    }

    if (filters.unreadOnly) {
      where.readAt = null
    }

    if (filters.type) {
      where.type = filters.type
    }

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters.limit,
      }),
      prisma.notification.count({
        where: { userId: userOrError.id, readAt: null },
      }),
    ])

    return NextResponse.json({ items, unreadCount })
  } catch (error) {
    return handleApiError(error)
  }
}
