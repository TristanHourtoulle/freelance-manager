import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { z } from "zod/v4"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  buildPagedResponse,
  getAuthUser,
  parsePagination,
  parseSearchQuery,
  requireSameOrigin,
} from "@/lib/api"
import { clientCreateSchema, clientStageSchema } from "@/lib/schemas/client"
import { deferActivityLog } from "@/lib/activity"
import {
  clientsTag,
  getClientsBillableSummary,
  getClientsFirstPage,
  getClientsRecencySummary,
  serializeClient,
} from "@/lib/data/clients"
import { navTag } from "@/lib/data/nav"

const clientsQuerySchema = z.object({
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  summary: z.enum(["billable", "recency"]).optional(),
  stage: clientStageSchema.optional(),
})

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const { cursor, limit } = parsePagination(req)
    const q = parseSearchQuery(req)
    const params = new URL(req.url).searchParams
    const { archived, summary, stage } = clientsQuerySchema.parse({
      archived: params.get("archived") ?? undefined,
      summary: params.get("summary") ?? undefined,
      stage: params.get("stage") ?? undefined,
    })

    if (summary === "billable") {
      return NextResponse.json(await getClientsBillableSummary(user.id))
    }

    if (summary === "recency") {
      return NextResponse.json(await getClientsRecencySummary(user.id))
    }

    if (!cursor && limit === 50 && !archived && !q && !stage) {
      return NextResponse.json(await getClientsFirstPage(user.id))
    }

    const rows = await prisma.client.findMany({
      where: {
        userId: user.id,
        archivedAt: archived ? { not: null } : null,
        ...(stage ? { stage } : {}),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" as const } },
                { lastName: { contains: q, mode: "insensitive" as const } },
                { company: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
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
        stage: data.stage ?? "ACTIVE",
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
