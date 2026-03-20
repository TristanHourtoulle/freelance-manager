import { NextResponse } from "next/server"
import { z } from "zod/v4"

import {
  getAuthenticatedUser,
  apiError,
  handleApiError,
  isLinearError,
} from "@/lib/api-utils"
import { linearClient } from "@/lib/linear"

const commentSchema = z.object({
  body: z.string().min(1).max(10000),
})

/**
 * POST /api/linear/issues/:id/comments
 * Creates a new comment on a Linear issue.
 * @returns 201 - `{ id, body, createdAt }`
 * @throws 401 - Unauthenticated
 * @throws 400 - Invalid body
 * @throws 502 - Linear API error
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id: issueId } = await params
    const body = await request.json()
    const { body: commentBody } = commentSchema.parse(body)

    const payload = await linearClient.createComment({
      issueId,
      body: commentBody,
    })

    const comment = await payload.comment

    if (!comment) {
      return apiError(
        "LINEAR_COMMENT_CREATE_FAILED",
        "Failed to create comment",
        502,
      )
    }

    const user = await comment.user

    return NextResponse.json(
      {
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
        user: user
          ? {
              id: user.id,
              name: user.name,
              avatarUrl: user.avatarUrl ?? undefined,
            }
          : undefined,
      },
      { status: 201 },
    )
  } catch (error) {
    if (isLinearError(error)) {
      return apiError(
        "LINEAR_COMMENT_CREATE_FAILED",
        "Failed to create comment in Linear",
        502,
      )
    }
    return handleApiError(error)
  }
}
