export type McpOriginResult =
  | { ok: true }
  | { ok: false; status: 403; code: "MCP_ORIGIN_FORBIDDEN" }

/**
 * Validate the Origin header of an MCP request (anti DNS-rebinding, per the
 * Streamable HTTP transport spec).
 *
 * Rule: an ABSENT Origin header is allowed — server-to-server MCP clients
 * (Claude Code, curl) do not send one, while browsers attach Origin to every
 * cross-origin POST, so a browser-originated cross-site request can never
 * arrive header-less. A PRESENT Origin must exactly equal
 * NEXT_PUBLIC_APP_URL (scheme + host, no trailing slash — the same exact
 * string comparison `requireSameOrigin` uses); anything else, including the
 * literal "null" opaque origin and any origin when NEXT_PUBLIC_APP_URL is
 * unset, is rejected with 403. In production NEXT_PUBLIC_APP_URL is https,
 * so a matching browser origin is necessarily https too. The bearer token
 * is the primary control — it is never ambient in a browser — and this
 * check fails closed on top of it for any browser-originated cross-site
 * request.
 *
 * @param request - The incoming HTTP request.
 * @returns `{ ok: true }` when acceptable, otherwise a 403 rejection.
 */
export function validateMcpOrigin(request: Request): McpOriginResult {
  const origin = request.headers.get("origin")
  if (origin === null) return { ok: true }

  const allowed = process.env.NEXT_PUBLIC_APP_URL
  if (allowed && origin === allowed) return { ok: true }

  return { ok: false, status: 403, code: "MCP_ORIGIN_FORBIDDEN" }
}
