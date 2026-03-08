import {
  getAuthenticatedUser,
  apiError,
  handleApiError,
  isLinearError,
} from "@/lib/api-utils"
import { fetchLinearTeams } from "@/lib/linear-service"
import { NextResponse } from "next/server"

/**
 * GET /api/linear/teams
 * Fetches all teams from the connected Linear workspace.
 * @returns 200 - `LinearTeam[]`
 * @throws 401 - Unauthenticated request
 * @throws 502 - Linear API error
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const teams = await fetchLinearTeams()
    return NextResponse.json(teams)
  } catch (error) {
    if (isLinearError(error)) {
      return apiError(
        "LINEAR_TEAMS_FETCH_FAILED",
        "Failed to fetch Linear teams",
        502,
      )
    }
    return handleApiError(error)
  }
}
