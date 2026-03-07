import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const notification = await prisma.notification.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!notification) {
      return apiError("NOTIF_NOT_FOUND", "Notification not found", 404)
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    })

    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
