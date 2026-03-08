import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { createLinearMappingBodySchema } from "@/lib/schemas/linear-mapping"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/clients/:id/linear-mappings
 * Lists all Linear mappings (team/project associations) for a client.
 * @returns 200 - `LinearMapping[]`
 * @throws 401 - Unauthenticated request
 * @throws 404 - Client not found
 */
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

/**
 * POST /api/clients/:id/linear-mappings
 * Creates a new Linear mapping for a client (team or project association).
 * @returns 201 - The created `LinearMapping`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid request body
 * @throws 404 - Client not found
 * @throws 409 - Duplicate mapping
 */
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
