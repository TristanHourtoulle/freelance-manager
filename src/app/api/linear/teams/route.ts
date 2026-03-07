import {
  getAuthenticatedUser,
  apiError,
  handleApiError,
  isLinearError,
} from "@/lib/api-utils"
import { fetchLinearTeams } from "@/lib/linear-service"
import { NextResponse } from "next/server"

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
