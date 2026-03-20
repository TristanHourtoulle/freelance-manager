import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.email().optional(),
  image: z
    .string()
    .max(700_000)
    .refine((v) => v.startsWith("data:image/"), "Must be a base64 data URL")
    .nullable()
    .optional(),
})

/**
 * GET /api/user
 * Returns the authenticated user's profile (id, name, email, image).
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const user = await prisma.user.findUnique({
      where: { id: userOrError.id },
      select: { id: true, name: true, email: true, image: true },
    })

    if (!user) {
      return apiError("USER_NOT_FOUND", "User not found", 404)
    }

    return NextResponse.json(user)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/user
 * Updates the authenticated user's profile photo.
 */
export async function PUT(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body: unknown = await request.json()
    const parsed = updateUserSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (parsed.name !== undefined) updateData.name = parsed.name
    if (parsed.email !== undefined) updateData.email = parsed.email
    if (parsed.image !== undefined) updateData.image = parsed.image

    const user = await prisma.user.update({
      where: { id: userOrError.id },
      data: updateData,
      select: { id: true, name: true, email: true, image: true },
    })

    return NextResponse.json(user)
  } catch (error) {
    return handleApiError(error)
  }
}
