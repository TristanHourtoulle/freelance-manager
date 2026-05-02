import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { linearMappingCreateSchema } from "@/lib/schemas/linear-mapping"
import { syncOneProject } from "@/lib/linear"

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
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
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

    if (data.linearProjectId) {
      const existing = await prisma.linearMapping.findFirst({
        where: {
          linearProjectId: data.linearProjectId,
          client: { userId: user.id },
        },
        include: {
          client: {
            select: {
              firstName: true,
              lastName: true,
              company: true,
            },
          },
        },
      })
      if (existing && existing.clientId !== id) {
        const label =
          existing.client.company ??
          `${existing.client.firstName} ${existing.client.lastName}`
        return NextResponse.json(
          {
            error: `Ce projet Linear est déjà lié au client ${label}`,
            conflictClientId: existing.clientId,
          },
          { status: 409 },
        )
      }
      if (existing && existing.clientId === id) {
        return NextResponse.json(existing, { status: 200 })
      }
    }

    const created = await prisma.linearMapping.create({
      data: {
        clientId: id,
        linearTeamId: data.linearTeamId ?? null,
        linearProjectId: data.linearProjectId ?? null,
      },
    })

    if (data.linearProjectId) {
      try {
        await syncOneProject({
          userId: user.id,
          clientId: id,
          linearProjectId: data.linearProjectId,
        })
      } catch (e) {
        console.warn("[linear] syncOneProject failed", e)
      }
    }
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
