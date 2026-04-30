import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"
import { linearMappingCreateSchema } from "@/lib/schemas/linear-mapping"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const mappings = await prisma.linearMapping.findMany({
      where: { clientId: id, client: { userId: user.id } },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ items: mappings })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function POST(req: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const data = linearMappingCreateSchema.parse({
      ...((await req.json()) as object),
      clientId: id,
    })

    const owned = await prisma.client.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!owned) return apiUnauthorized()

    const created = await prisma.linearMapping.create({
      data: {
        clientId: id,
        linearTeamId: data.linearTeamId ?? null,
        linearProjectId: data.linearProjectId ?? null,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
