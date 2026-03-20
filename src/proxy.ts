import { NextRequest, NextResponse } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

/** Routes that bypass the API authentication check in the proxy. */
const PUBLIC_API_PATTERNS = [
  "/api/auth/",
  "/api/health",
  "/api/webhooks/",
  "/api/locale",
]

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PATTERNS.some((pattern) => pathname.startsWith(pattern))
}

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request)
  const { pathname } = request.nextUrl

  const isAuthRoute = pathname.startsWith("/auth")
  const isApiRoute = pathname.startsWith("/api")

  // Fast-reject unauthenticated API requests (except public routes)
  if (isApiRoute && !isPublicApiRoute(pathname) && !sessionCookie) {
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

  if (!sessionCookie && !isAuthRoute && !isApiRoute && pathname !== "/") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  if (sessionCookie && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  if (sessionCookie && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
