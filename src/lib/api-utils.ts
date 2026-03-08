import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

import type { Client, LinearMapping } from "@/generated/prisma/client"

/** Authenticated user extracted from the session. */
interface AuthenticatedUser {
  id: string
  name: string
  email: string
}

/**
 * Extracts the authenticated user from the request session.
 * Returns a 401 JSON response if the session is missing or invalid.
 *
 * @param request - Incoming HTTP request with session headers
 * @returns The authenticated user, or a 401 NextResponse
 */
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

/**
 * Builds a structured JSON error response.
 *
 * @param code - Machine-readable error code (e.g. "VAL_INVALID_INPUT")
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param details - Optional additional error details (e.g. Zod issues)
 * @returns NextResponse with the error envelope
 */
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

/**
 * Converts an unknown error into a structured JSON error response.
 * Handles ZodError as 400 validation errors; everything else as 500.
 *
 * @param error - The caught error
 * @returns NextResponse with the appropriate error envelope and status
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return apiError("VAL_INVALID_INPUT", "Validation failed", 400, error.issues)
  }

  return apiError("SYS_INTERNAL_ERROR", "Internal server error", 500)
}

/**
 * Checks whether an error originates from the Linear SDK.
 *
 * @param error - The caught error
 * @returns `true` if the error is a Linear API error
 */
export function isLinearError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.constructor.name === "LinearError" ||
      error.constructor.name === "LinearGraphQLError" ||
      error.message.includes("Linear"))
  )
}

/**
 * Serializes a Prisma Client model into a JSON-safe object.
 * Converts Decimal `rate` to number and formats computed fields.
 *
 * @param client - Prisma client record with optional Linear mappings
 * @param computed - Optional computed fields (totalRevenue, lastActivityAt)
 * @returns Plain object safe for JSON serialization
 */
export function serializeClient(
  client: Client & { linearMappings?: LinearMapping[] },
  computed?: { totalRevenue?: number; lastActivityAt?: Date | null },
) {
  return {
    ...client,
    rate: Number(client.rate),
    totalRevenue: computed?.totalRevenue ?? 0,
    lastActivityAt: computed?.lastActivityAt?.toISOString() ?? null,
  }
}
