import { NextResponse, type NextRequest } from "next/server"

/**
 * Edge-runtime auth gate for /api/* routes.
 *
 * "Defense in depth": every Route Handler ALSO calls `getAuthUser()` before
 * any DB access. The proxy is the safety net for the day a developer adds
 * a new route and forgets the per-route check — the route is auth-by-default
 * because the proxy 401s any request without a session cookie.
 *
 * The proxy only checks COOKIE PRESENCE, not signature validity, because
 * better-auth's session validation depends on Prisma which can't run on
 * the edge. Cookie validation happens inside the route via getAuthUser().
 *
 * Excluded paths (must remain reachable without auth):
 * - /api/auth/*       — better-auth's own handler
 * - /api/health       — gated separately by X-Health-Key (TRI-602)
 *
 * @see TRI-599 for context.
 */
const SESSION_COOKIE_PREFIXES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
]

const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"]

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  if (
    PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  const hasSession = SESSION_COOKIE_PREFIXES.some((name) =>
    Boolean(request.cookies.get(name)?.value),
  )

  if (!hasSession) {
    return NextResponse.json(
      { error: "Unauthorized", code: "PROXY_NO_SESSION" },
      { status: 401 },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/api/:path*"],
}
