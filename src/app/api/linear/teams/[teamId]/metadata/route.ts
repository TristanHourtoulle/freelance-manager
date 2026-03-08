import {
  getAuthenticatedUser,
  apiError,
  handleApiError,
  isLinearError,
} from "@/lib/api-utils"
import {
  fetchLinearTeamMembers,
  fetchLinearTeamLabels,
  fetchLinearWorkflowStates,
} from "@/lib/linear-service"
import { NextResponse } from "next/server"

/**
 * GET /api/linear/teams/[teamId]/metadata
 * Fetches team members, workflow states, and labels for a team.
 * @returns 200 - `{ members, states, labels }`
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { teamId } = await params

    const [members, states, labels] = await Promise.all([
      fetchLinearTeamMembers(teamId),
      fetchLinearWorkflowStates(teamId),
      fetchLinearTeamLabels(teamId),
    ])

    return NextResponse.json({ members, states, labels })
  } catch (error) {
    if (isLinearError(error)) {
      return apiError(
        "LINEAR_METADATA_FETCH_FAILED",
        "Failed to fetch team metadata",
        502,
      )
    }
    return handleApiError(error)
  }
}
