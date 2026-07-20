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
import { quoteCreateSchema, quoteStatusSchema } from "@/lib/schemas/quote"
import { sumLines } from "@/lib/billing-math"
import { serializeQuote } from "@/domain/quotes/serialize"
import { nextQuoteNumber } from "@/lib/quote-numbering"
import { navTag } from "@/lib/data/nav"

const quotesQuerySchema = z.object({
  status: quoteStatusSchema.optional(),
  clientId: z.string().min(1).optional(),
})

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const { cursor, limit } = parsePagination(req)
    const q = parseSearchQuery(req)
    const params = new URL(req.url).searchParams
    const { status, clientId } = quotesQuerySchema.parse({
      status: params.get("status") ?? undefined,
      clientId: params.get("clientId") ?? undefined,
    })

    const rows = await prisma.quote.findMany({
      where: {
        userId: user.id,
        ...(status ? { status } : {}),
        ...(clientId ? { clientId } : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: "insensitive" as const } },
                {
                  client: {
                    OR: [
                      {
                        firstName: {
                          contains: q,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        lastName: { contains: q, mode: "insensitive" as const },
                      },
                      {
                        company: { contains: q, mode: "insensitive" as const },
                      },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { _count: { select: { lines: true } } },
    })
    const paged = buildPagedResponse(rows, limit)
    return NextResponse.json({
      data: paged.data.map(serializeQuote),
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
    const data = quoteCreateSchema.parse(body)
    const year = new Date(data.issueDate).getFullYear()

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id },
      select: { id: true },
    })
    if (!client) return apiUnauthorized()

    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: data.projectId,
          userId: user.id,
          clientId: data.clientId,
        },
        select: { id: true },
      })
      if (!project) {
        return NextResponse.json(
          { error: "Bad Request", code: "INVALID_PROJECT_FOR_CLIENT" },
          { status: 400 },
        )
      }
    }

    const subtotal = sumLines(
      data.lines.map((l) => ({ qty: Number(l.qty), rate: Number(l.rate) })),
    )

    const customNumber = data.number?.trim()
    if (customNumber) {
      const conflict = await prisma.quote.findFirst({
        where: { userId: user.id, number: customNumber },
        select: { id: true },
      })
      if (conflict) {
        return NextResponse.json(
          { error: "Conflict", code: "QUOTE_NUMBER_TAKEN" },
          { status: 409 },
        )
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const number = customNumber || (await nextQuoteNumber(tx, user.id, year))

      return tx.quote.create({
        data: {
          userId: user.id,
          clientId: data.clientId,
          projectId: data.projectId ?? null,
          number,
          status: data.status,
          issueDate: new Date(data.issueDate),
          validUntil: data.validUntil ? new Date(data.validUntil) : null,
          sentAt: data.status === "DRAFT" ? null : new Date(),
          subtotal,
          total: subtotal,
          notes: data.notes ?? null,
          externalUrl: data.externalUrl ?? null,
          lines: {
            create: data.lines.map((l, i) => ({
              taskId: l.taskId ?? null,
              label: l.label,
              qty: Number(l.qty),
              rate: Number(l.rate),
              position: i,
            })),
          },
        },
        include: { _count: { select: { lines: true } } },
      })
    })

    revalidateTag(navTag(user.id), "max")
    return NextResponse.json(serializeQuote(created), { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
