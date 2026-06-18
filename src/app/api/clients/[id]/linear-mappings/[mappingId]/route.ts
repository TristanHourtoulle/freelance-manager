import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { projectsTag } from "@/lib/data/projects"
import { navTag } from "@/lib/data/nav"

interface Params {
  params: Promise<{ id: string; mappingId: string }>
}

export async function DELETE(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id, mappingId } = await params
  try {
    await prisma.linearMapping.deleteMany({
      where: { id: mappingId, clientId: id, client: { userId: user.id } },
    })
    revalidateTag(projectsTag(user.id), "max")
    revalidateTag(navTag(user.id), "max")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
