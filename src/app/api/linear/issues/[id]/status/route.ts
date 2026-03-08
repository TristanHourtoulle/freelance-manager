import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { updateLinearIssueStatus } from "@/lib/linear-service"

const updateStatusSchema = z.object({
  stateId: z.string().min(1),
})

/**
 * PATCH /api/linear/issues/[id]/status
 * Updates the workflow status of a Linear issue.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await params
    if (!id) {
      return apiError("VAL_MISSING_PARAM", "Missing issue id parameter", 400)
    }

    const body = await request.json()
    const { stateId } = updateStatusSchema.parse(body)

    await updateLinearIssueStatus(id, stateId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
