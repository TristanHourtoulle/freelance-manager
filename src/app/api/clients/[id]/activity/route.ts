import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const items = await prisma.activityLog.findMany({
      where: { userId: user.id, clientId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        kind: true,
        title: true,
        meta: true,
        createdAt: true,
        invoiceId: true,
        projectId: true,
      },
    })
    return NextResponse.json({
      items: items.map((a) => ({
        id: a.id,
        kind: a.kind,
        title: a.title,
        meta: a.meta,
        createdAt: a.createdAt.toISOString(),
        invoiceId: a.invoiceId,
        projectId: a.projectId,
      })),
    })
  } catch (error) {
    return apiServerError(error)
  }
}
