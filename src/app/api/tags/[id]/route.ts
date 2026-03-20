import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { updateTagSchema } from "@/lib/schemas/tag"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/tags/:id
 * Updates a tag's name and/or color.
 * @returns 200 - The updated tag
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const existing = await prisma.tag.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!existing) {
      return apiError("TAG_NOT_FOUND", "Tag not found", 404)
    }

    const body = await request.json()
    const validated = updateTagSchema.parse(body)

    const tag = await prisma.tag.update({
      where: { id },
      data: validated,
    })

    return NextResponse.json(tag)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/tags/:id
 * Deletes a tag. Prisma implicit many-to-many handles join table cleanup.
 * @returns 204 - No content
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const existing = await prisma.tag.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!existing) {
      return apiError("TAG_NOT_FOUND", "Tag not found", 404)
    }

    await prisma.tag.delete({ where: { id } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
