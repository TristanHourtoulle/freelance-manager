import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string; mappingId: string }>
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id, mappingId } = await context.params

    const client = await prisma.client.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!client) {
      return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    }

    const mapping = await prisma.linearMapping.findFirst({
      where: { id: mappingId, clientId: id },
    })

    if (!mapping) {
      return apiError("MAPPING_NOT_FOUND", "Mapping not found", 404)
    }

    await prisma.linearMapping.delete({ where: { id: mappingId } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
