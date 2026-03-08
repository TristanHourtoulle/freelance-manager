import { prisma } from "@/lib/db"
import {
  apiError,
  getAuthenticatedUser,
  handleApiError,
  serializeClient,
} from "@/lib/api-utils"
import { updateClientSchema } from "@/lib/schemas/client"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/clients/:id
 * Retrieves a single client by ID.
 * @returns 200 - The `SerializedClient`
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

    return NextResponse.json(serializeClient(client))
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/clients/:id
 * Updates an existing client by ID.
 * @returns 200 - The updated `SerializedClient`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid request body
 * @throws 404 - Client not found
 */
export async function PUT(request: Request, context: RouteContext) {
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

    const body = await request.json()
    const validated = updateClientSchema.parse(body)

    const client = await prisma.client.update({
      where: { id },
      data: validated,
    })

    return NextResponse.json(serializeClient(client))
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/clients/:id
 * Permanently deletes a client by ID.
 * @returns 204 - No content
 * @throws 401 - Unauthenticated request
 * @throws 404 - Client not found
 */
export async function DELETE(request: Request, context: RouteContext) {
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

    await prisma.client.delete({ where: { id } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
