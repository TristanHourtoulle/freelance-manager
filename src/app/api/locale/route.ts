import { NextResponse } from "next/server"
import { z } from "zod/v4"

const localeSchema = z.object({
  locale: z.enum(["en", "fr"]),
})

/**
 * POST /api/locale
 * Sets the locale cookie for the current user.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json()
  const parsed = localeSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 })
  }

  const response = NextResponse.json({ locale: parsed.data.locale })
  response.cookies.set("locale", parsed.data.locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  return response
}
