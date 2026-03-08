import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { markInvoicedSchema } from "@/lib/schemas/billing"
import { NextResponse } from "next/server"

/**
 * POST /api/billing/mark-invoiced
 * Marks a batch of tasks as invoiced by their Linear issue IDs.
 * @returns 200 - `{ markedCount: number }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid request body (missing linearIssueIds)
 * @throws 403 - Attempting to mark tasks owned by another user
 */
export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body = await request.json()
    const validated = markInvoicedSchema.parse(body)

    const overrides = await prisma.taskOverride.findMany({
      where: {
        linearIssueId: { in: validated.linearIssueIds },
        toInvoice: true,
        invoiced: false,
      },
      include: { client: { select: { userId: true } } },
    })

    const unauthorized = overrides.filter(
      (o) => o.client.userId !== userOrError.id,
    )
    if (unauthorized.length > 0) {
      return apiError(
        "AUTH_FORBIDDEN",
        "Not authorized to mark these tasks",
        403,
      )
    }

    const validIds = overrides.map((o) => o.linearIssueId)

    if (validIds.length === 0) {
      return NextResponse.json({ markedCount: 0 })
    }

    await prisma.taskOverride.updateMany({
      where: { linearIssueId: { in: validIds } },
      data: {
        invoiced: true,
        invoicedAt: new Date(),
      },
    })

    return NextResponse.json({ markedCount: validIds.length })
  } catch (error) {
    return handleApiError(error)
  }
}
