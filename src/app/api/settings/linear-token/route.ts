import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { linearTokenSchema } from "@/lib/schemas/settings"
import { clearLinearToken, setLinearToken } from "@/lib/linear"
import { linearProjectsTag, linearTeamsTag } from "@/lib/data/linear"

export async function PUT(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const { token } = linearTokenSchema.parse(await req.json())
    await setLinearToken(user.id, token)
    revalidateTag(linearTeamsTag(user.id), "max")
    revalidateTag(linearProjectsTag(user.id), "max")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function DELETE(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    await clearLinearToken(user.id)
    revalidateTag(linearTeamsTag(user.id), "max")
    revalidateTag(linearProjectsTag(user.id), "max")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
