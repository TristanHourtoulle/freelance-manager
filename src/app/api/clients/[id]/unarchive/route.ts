import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    await prisma.client.updateMany({
      where: { id, userId: user.id },
      data: { archivedAt: null },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
