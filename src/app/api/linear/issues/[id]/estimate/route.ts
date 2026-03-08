import { NextResponse } from "next/server"
import {
  getAuthenticatedUser,
  apiError,
  handleApiError,
  isLinearError,
} from "@/lib/api-utils"
import { updateLinearIssueEstimate } from "@/lib/linear-service"
import { updateEstimateSchema } from "@/lib/schemas/linear"

/**
 * PATCH /api/linear/issues/:id/estimate
 * Updates the estimate (story points) of a Linear issue.
 * @returns 200 - `{ estimate: number }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid request body
 * @throws 502 - Linear API error
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userOrError = await getAuthenticatedUser(request)
  if (userOrError instanceof NextResponse) return userOrError

  try {
    const { id } = await params
    const body = await request.json()
    const { estimate } = updateEstimateSchema.parse(body)

    await updateLinearIssueEstimate(id, estimate)

    return NextResponse.json({ estimate })
  } catch (error) {
    if (isLinearError(error)) {
      return apiError(
        "LINEAR_ESTIMATE_UPDATE_FAILED",
        "Failed to update estimate in Linear",
        502,
      )
    }
    return handleApiError(error)
  }
}
