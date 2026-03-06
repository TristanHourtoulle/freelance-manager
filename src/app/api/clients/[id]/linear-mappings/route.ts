import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { createLinearMappingBodySchema } from "@/lib/schemas/linear-mapping"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const client = await prisma.client.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!client) {
      return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    }

    const mappings = await prisma.linearMapping.findMany({
      where: { clientId: id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(mappings)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const client = await prisma.client.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!client) {
      return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    }

    const body = await request.json()
    const validated = createLinearMappingBodySchema.parse(body)

    const mapping = await prisma.linearMapping.create({
      data: {
        clientId: id,
        ...validated,
      },
    })

    return NextResponse.json(mapping, { status: 201 })
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return apiError(
        "MAPPING_DUPLICATE",
        "This project or team is already mapped to a client",
        409,
      )
    }
    return handleApiError(error)
  }
}
