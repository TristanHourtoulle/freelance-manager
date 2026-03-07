import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

import type { Client, LinearMapping } from "@/generated/prisma/client"

interface AuthenticatedUser {
  id: string
  name: string
  email: string
}

export async function getAuthenticatedUser(
  request: Request,
): Promise<AuthenticatedUser | NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: {
          code: "AUTH_NOT_AUTHENTICATED",
          message: "Not authenticated",
        },
      },
      { status: 401 },
    )
  }

  return session.user as AuthenticatedUser
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  )
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return apiError("VAL_INVALID_INPUT", "Validation failed", 400, error.issues)
  }

  return apiError("SYS_INTERNAL_ERROR", "Internal server error", 500)
}

export function isLinearError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.constructor.name === "LinearError" ||
      error.constructor.name === "LinearGraphQLError" ||
      error.message.includes("Linear"))
  )
}

export function serializeClient(
  client: Client & { linearMappings?: LinearMapping[] },
) {
  return {
    ...client,
    rate: Number(client.rate),
  }
}
