import { prisma } from "@/lib/db"
import {
  apiError,
  getAuthenticatedUser,
  handleApiError,
  serializeClient,
} from "@/lib/api-utils"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const existing = await prisma.client.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!existing) {
      return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    }

    if (existing.archivedAt) {
      return apiError(
        "CLIENT_ALREADY_ARCHIVED",
        "Client is already archived",
        409,
      )
    }

    const client = await prisma.client.update({
      where: { id },
      data: { archivedAt: new Date() },
    })

    return NextResponse.json(serializeClient(client))
  } catch (error) {
    return handleApiError(error)
  }
}
