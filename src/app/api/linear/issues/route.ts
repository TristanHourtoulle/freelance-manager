import {
  getAuthenticatedUser,
  apiError,
  handleApiError,
  isLinearError,
} from "@/lib/api-utils"
import { fetchLinearIssues } from "@/lib/linear-service"
import { linearIssuesFilterSchema } from "@/lib/schemas/linear"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const filters = linearIssuesFilterSchema.parse(params)

    const issues = await fetchLinearIssues(filters)
    return NextResponse.json(issues)
  } catch (error) {
    if (isLinearError(error)) {
      return apiError(
        "LINEAR_ISSUES_FETCH_FAILED",
        "Failed to fetch Linear issues",
        502,
      )
    }
    return handleApiError(error)
  }
}
