import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
} from "@/lib/api"
import { logActivity } from "@/lib/activity"

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const owned = await prisma.client.findFirst({
      where: { id, userId: user.id },
      select: { id: true, firstName: true, lastName: true, company: true },
    })
    if (!owned) return apiNotFound()

    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id },
        data: { archivedAt: new Date() },
      })
      await logActivity(tx, {
        userId: user.id,
        kind: "CLIENT_ARCHIVED",
        title: `Client ${owned.company ?? `${owned.firstName} ${owned.lastName}`} archivé`,
        clientId: id,
      })
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
