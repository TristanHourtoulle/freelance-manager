import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  getAuthUser,
  parsePagination,
  requireSameOrigin,
} from "@/lib/api"
import { clientCreateSchema } from "@/lib/schemas/client"
import { deferActivityLog } from "@/lib/activity"
import {
  clientsTag,
  getClientsFirstPage,
  serializeClient,
} from "@/lib/data/clients"
import { navTag } from "@/lib/data/nav"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const { cursor, limit } = parsePagination(req)
    const archived = new URL(req.url).searchParams.get("archived") === "true"

    if (!cursor && limit === 50 && !archived) {
      return NextResponse.json(await getClientsFirstPage(user.id))
    }

    const rows = await prisma.client.findMany({
      where: {
        userId: user.id,
        archivedAt: archived ? { not: null } : null,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const paged = buildPagedResponse(rows, limit)
    return NextResponse.json({
      data: paged.data.map(serializeClient),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const body = await req.json()
    const data = clientCreateSchema.parse(body)
    const created = await prisma.client.create({
      data: {
        userId: user.id,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null,
        billingMode: data.billingMode ?? "DAILY",
        rate: data.rate ?? 0,
        fixedPrice: data.fixedPrice ?? null,
        deposit: data.deposit ?? null,
        paymentTerms: data.paymentTerms ?? null,
        category: data.category ?? "FREELANCE",
        color: data.color ?? null,
        starred: data.starred ?? false,
      },
    })
    revalidateTag(clientsTag(user.id), "max")
    revalidateTag(navTag(user.id), "max")
    deferActivityLog({
      userId: user.id,
      kind: "CLIENT_CREATED",
      title: `Client ${created.company ?? `${created.firstName} ${created.lastName}`} créé`,
      clientId: created.id,
    })
    return NextResponse.json(serializeClient(created), { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
