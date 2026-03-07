import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"

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
