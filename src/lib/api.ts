import "server-only"
import { cache } from "react"
import { NextResponse } from "next/server"
import { headers as nextHeaders } from "next/headers"
import { ZodError } from "zod/v4"
import { Prisma } from "@/generated/prisma/client"
import { auth } from "@/lib/auth"

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
