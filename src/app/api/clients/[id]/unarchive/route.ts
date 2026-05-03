import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { clientsTag } from "@/lib/data/clients"
import { navTag } from "@/lib/data/nav"

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    await prisma.client.updateMany({
      where: { id, userId: user.id },
      data: { archivedAt: null },
    })
    revalidateTag(clientsTag(user.id), "max")
    revalidateTag(navTag(user.id), "max")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
