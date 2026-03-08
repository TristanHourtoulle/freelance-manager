import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"

/**
 * POST /api/notifications/dismiss-all
 * Marks all unread notifications as read for the authenticated user.
 * @returns 200 - `{ dismissed: number }`
 * @throws 401 - Unauthenticated request
 */
export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const result = await prisma.notification.updateMany({
      where: { userId: userOrError.id, readAt: null },
      data: { readAt: new Date() },
    })

    return NextResponse.json({ dismissed: result.count })
  } catch (error) {
    return handleApiError(error)
  }
}
