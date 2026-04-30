import { NextResponse } from "next/server"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"
import { linearTokenSchema } from "@/lib/schemas/settings"
import { clearLinearToken, setLinearToken } from "@/lib/linear"

export async function PUT(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const { token } = linearTokenSchema.parse(await req.json())
    await setLinearToken(user.id, token)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function DELETE() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    await clearLinearToken(user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
