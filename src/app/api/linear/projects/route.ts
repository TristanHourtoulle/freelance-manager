import {
  getAuthenticatedUser,
  apiError,
  handleApiError,
  isLinearError,
} from "@/lib/api-utils"
import { fetchLinearProjects } from "@/lib/linear-service"
import { linearProjectsFilterSchema } from "@/lib/schemas/linear"
import { NextResponse } from "next/server"

/**
 * GET /api/linear/projects
 * Fetches Linear projects, optionally filtered by team ID.
 * @returns 200 - `LinearProject[]`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid query parameters
 * @throws 502 - Linear API error
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const { teamId } = linearProjectsFilterSchema.parse(params)

    const projects = await fetchLinearProjects(teamId)
    return NextResponse.json(projects)
  } catch (error) {
    if (isLinearError(error)) {
      return apiError(
        "LINEAR_PROJECTS_FETCH_FAILED",
        "Failed to fetch Linear projects",
        502,
      )
    }
    return handleApiError(error)
  }
}
