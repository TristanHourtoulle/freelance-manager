import "server-only"
import { cache } from "react"
import { NextResponse } from "next/server"
import { headers as nextHeaders } from "next/headers"
import { ZodError } from "zod/v4"
import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/lib/auth"
import { paginationQuerySchema } from "@/lib/schemas/pagination"
import { searchQuerySchema } from "@/lib/schemas/search"

export interface ApiUser {
  id: string
  email: string
  name: string
}

/**
 * Resolve the current authenticated user from the request cookies. Returns
 * null when the request is unauthenticated — callers wrap with apiUnauthorized()
 * when null. Memoized per request via React.cache so multiple call sites in
 * the same render tree (layout + page + cached data fns) share one lookup.
 */
export const getAuthUser = cache(async (): Promise<ApiUser | null> => {
  const session = await auth.api.getSession({ headers: await nextHeaders() })
  if (!session?.user) return null
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  }
})

export function apiUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

export function apiBadRequest(detail: unknown) {
  return NextResponse.json({ error: "Bad Request", detail }, { status: 400 })
}

export function apiNotFound() {
  return NextResponse.json({ error: "Not Found" }, { status: 404 })
}

export function apiServerError(error: unknown) {
  if (error instanceof ZodError) {
    return apiBadRequest(error.flatten())
  }
  console.error("[api] unexpected error", error)
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
}

/**
 * Serialize a Prisma Decimal to a plain number. We only deal with euros and
 * day estimates (≤ a few thousand) so JS number precision is fine.
 */
export function decimalToNumber(
  d: Prisma.Decimal | number | null | undefined,
): number | null {
  if (d == null) return null
  if (typeof d === "number") return d
  return d.toNumber()
}

export function dateToISO(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toISOString()
}

/**
 * Reject mutating requests whose Origin/Referer doesn't match
 * NEXT_PUBLIC_APP_URL. Defense-in-depth against CSRF attacks even when
 * the session cookie is cross-origin-leakable (e.g. SameSite=Lax). Pair
 * with `cookieOptions.sameSite='strict'` in the better-auth config.
 *
 * Returns a 403 NextResponse on mismatch, or `null` to proceed.
 *
 * @example
 *   export async function POST(request: Request) {
 *     const csrf = requireSameOrigin(request)
 *     if (csrf) return csrf
 *     // … rest of handler
 *   }
 */
export function requireSameOrigin(request: Request): NextResponse | null {
  const expected = process.env.NEXT_PUBLIC_APP_URL
  if (!expected) return null
  const origin = request.headers.get("origin")
  if (origin) {
    return origin === expected
      ? null
      : NextResponse.json(
          { error: "Forbidden", code: "CSRF_ORIGIN_MISMATCH" },
          { status: 403 },
        )
  }
  const referer = request.headers.get("referer")
  if (referer && referer.startsWith(expected)) return null
  return NextResponse.json(
    { error: "Forbidden", code: "CSRF_ORIGIN_MISSING" },
    { status: 403 },
  )
}

/**
 * Resolve the calling client's IP address. Honours x-forwarded-for and
 * x-real-ip ONLY when TRUST_PROXY=1 is set in the environment, otherwise
 * the headers are user-controllable and can be spoofed (returns 'unknown'
 * in that case to make rate-limiters fail closed). Set TRUST_PROXY=1 only
 * when running behind Vercel/Cloudflare/nginx that strips client-supplied
 * X-Forwarded-For headers.
 */
/**
 * Parse and validate `?cursor=&limit=` from a request. Returns sane defaults
 * (`{ cursor: undefined, limit: 50 }`) when missing, throws ZodError on
 * malformed input — `apiServerError` already maps that to a 400.
 *
 * Pair the result with Prisma's `cursor: { id: cursor }` + `skip: 1` and
 * `take: limit + 1` so the handler can detect `hasMore` from the overflow row.
 */
export function parsePagination(request: Request): {
  cursor: string | undefined
  limit: number
} {
  const url = new URL(request.url)
  const parsed = paginationQuerySchema.parse({
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  })
  return { cursor: parsed.cursor, limit: parsed.limit }
}

/**
 * Parse and validate the optional `?q=` free-text search term of a list
 * endpoint. Blank or missing terms resolve to `undefined` so the handler keeps
 * its unfiltered behavior; an over-long term throws a ZodError, which
 * `apiServerError` maps to a 400.
 *
 * @param request - The incoming request.
 * @returns The trimmed search term, or `undefined` when absent.
 */
export function parseSearchQuery(request: Request): string | undefined {
  const raw = new URL(request.url).searchParams.get("q")
  if (raw == null) return undefined
  const { q } = searchQuerySchema.parse({ q: raw })
  return q ? q : undefined
}

/**
 * Slice an over-fetched array (length `limit + 1`) into `{ data, nextCursor,
 * hasMore }` for the wire response.
 */
export function buildPagedResponse<T extends { id: string }>(
  rows: T[],
  limit: number,
): { data: T[]; nextCursor: string | null; hasMore: boolean } {
  const hasMore = rows.length > limit
  const data = hasMore ? rows.slice(0, limit) : rows
  const last = data[data.length - 1]
  return {
    data,
    nextCursor: hasMore && last ? last.id : null,
    hasMore,
  }
}

export function getClientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY === "1"
  if (!trustProxy) return "unknown"
  const fwd = request.headers.get("x-forwarded-for")
  if (fwd) {
    const first = fwd.split(",")[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get("x-real-ip")
  if (real) return real
  return "unknown"
}
