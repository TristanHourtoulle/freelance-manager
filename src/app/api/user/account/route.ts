import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

const deleteSchema = z.object({
  confirm: z.literal("DELETE"),
})

/**
 * DELETE /api/user/account
 * Permanently deletes the authenticated user's account and all data.
 */
export async function DELETE(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body: unknown = await request.json()
    const parsed = deleteSchema.safeParse(body)

    if (!parsed.success) {
      return apiError(
        "CONFIRM_REQUIRED",
        'You must send { "confirm": "DELETE" } to delete your account.',
        400,
      )
    }

    // Prisma cascades handle Client -> TaskOverride, Invoice, LinearMapping, etc.
    await prisma.user.delete({ where: { id: userOrError.id } })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
