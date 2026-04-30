import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"

interface Params {
  params: Promise<{ id: string; mappingId: string }>
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id, mappingId } = await params
  try {
    await prisma.linearMapping.deleteMany({
      where: { id: mappingId, clientId: id, client: { userId: user.id } },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
