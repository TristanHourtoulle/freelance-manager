import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { createTagSchema } from "@/lib/schemas/tag"
import { NextResponse } from "next/server"

/**
 * GET /api/tags
 * Lists all tags for the authenticated user, ordered by name.
 * @returns 200 - Array of tags
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const tags = await prisma.tag.findMany({
      where: { userId: userOrError.id },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ items: tags })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/tags
 * Creates a new tag for the authenticated user.
 * @returns 201 - The created tag
 */
export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body = await request.json()
    const validated = createTagSchema.parse(body)

    const tag = await prisma.tag.create({
      data: {
        ...validated,
        userId: userOrError.id,
      },
    })

    return NextResponse.json(tag, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
