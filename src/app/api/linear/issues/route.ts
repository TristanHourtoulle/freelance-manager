import {
  getAuthenticatedUser,
  apiError,
  handleApiError,
  isLinearError,
} from "@/lib/api-utils"
import { prisma } from "@/lib/db"
import { fetchLinearIssues, createLinearIssue } from "@/lib/linear-service"
import {
  linearIssuesFilterSchema,
  createLinearIssueSchema,
} from "@/lib/schemas/linear"
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

export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body = await request.json()
    const validated = createLinearIssueSchema.parse(body)

    const mapping = await prisma.linearMapping.findFirst({
      where: {
        linearProjectId: validated.projectId,
        client: { userId: userOrError.id },
      },
    })

    if (!mapping) {
      return apiError(
        "LINEAR_PROJECT_NOT_MAPPED",
        "Project is not mapped to any of your clients",
        403,
      )
    }

    const issue = await createLinearIssue(validated)
    return NextResponse.json(issue, { status: 201 })
  } catch (error) {
    if (isLinearError(error)) {
      return apiError(
        "LINEAR_ISSUE_CREATE_FAILED",
        "Failed to create Linear issue",
        502,
      )
    }
    return handleApiError(error)
  }
}
