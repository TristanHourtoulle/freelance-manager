import "server-only"
import { createHash, timingSafeEqual } from "crypto"
import { prisma } from "@/lib/db"

const TOKEN_HASH_PATTERN = /^[0-9a-f]{64}$/

export type McpAuthResult =
  | { ok: true; userId: string }
  | {
      ok: false
      status: 401 | 503
      code:
        | "MCP_NOT_CONFIGURED"
        | "MCP_BAD_TOKEN"
        | "MCP_NO_PRINCIPAL"
        | "MCP_AMBIGUOUS_PRINCIPAL"
    }

/**
 * Authorize an MCP request against MCP_TOKEN_HASH and resolve its principal.
 *
 * Fails CLOSED, mirroring `authorizeCronRequest`: when MCP_TOKEN_HASH is
 * unset or malformed the endpoint returns 503 rather than open, so a
 * misconfigured deployment can never expose an unauthenticated MCP surface.
 * The bearer token is hashed with SHA-256 before comparison, so both sides
 * of the comparison are always exactly 32 bytes and `timingSafeEqual` runs
 * on every attempt — there is no length-based early return that could leak
 * timing information. The token and hash are never logged nor echoed back.
 *
 * The principal is the single owner of this operationally single-user app:
 * the token is only accepted while exactly one User row exists. Unlike the
 * daily jobs, which iterate all users, this endpoint refuses to guess — if
 * a second user row ever appears the token becomes ambiguous and the
 * endpoint disables itself with 503 until an explicit token-per-user
 * mapping is introduced.
 *
 * @param request - The incoming HTTP request carrying `Authorization: Bearer`.
 * @returns `{ ok: true, userId }` when authorized, otherwise the status and
 *   internal code to map to a response (the code is never sent to clients).
 */
export async function authorizeMcpRequest(
  request: Request,
): Promise<McpAuthResult> {
  const expectedHash = process.env.MCP_TOKEN_HASH?.toLowerCase()
  if (!expectedHash || !TOKEN_HASH_PATTERN.test(expectedHash)) {
    return { ok: false, status: 503, code: "MCP_NOT_CONFIGURED" }
  }

  const token = extractBearerToken(request.headers.get("authorization"))
  if (token === null || !constantTimeDigestMatch(token, expectedHash)) {
    return { ok: false, status: 401, code: "MCP_BAD_TOKEN" }
  }

  return resolveOwnerPrincipal()
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer +(\S+)$/i.exec(header.trim())
  return match?.[1] ?? null
}

function constantTimeDigestMatch(
  token: string,
  expectedHexDigest: string,
): boolean {
  const presented = createHash("sha256").update(token, "utf8").digest()
  const expected = Buffer.from(expectedHexDigest, "hex")
  return timingSafeEqual(presented, expected)
}

async function resolveOwnerPrincipal(): Promise<McpAuthResult> {
  const users = await prisma.user.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 2,
  })
  const owner = users[0]
  if (!owner) {
    return { ok: false, status: 503, code: "MCP_NO_PRINCIPAL" }
  }
  if (users.length > 1) {
    return { ok: false, status: 503, code: "MCP_AMBIGUOUS_PRINCIPAL" }
  }
  return { ok: true, userId: owner.id }
}
