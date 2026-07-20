import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { quoteUpdateSchema } from "@/lib/schemas/quote"
import { sumLines } from "@/lib/billing-math"
import { serializeQuote, serializeQuoteLine } from "@/domain/quotes/serialize"
import type { QuoteDetail, QuoteStatus } from "@/domain/quotes/types"
import { navTag } from "@/lib/data/nav"

interface Params {
  params: Promise<{ id: string }>
}

const DECIDED_STATUSES: readonly QuoteStatus[] = [
  "ACCEPTED",
  "REFUSED",
  "EXPIRED",
]

export async function GET(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const quote = await prisma.quote.findFirst({
      where: { id, userId: user.id },
      include: {
        _count: { select: { lines: true } },
        lines: { orderBy: { position: "asc" } },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            billingMode: true,
            color: true,
          },
        },
      },
    })
    if (!quote) return apiNotFound()

    const detail: QuoteDetail = {
      ...serializeQuote(quote),
      client: {
        id: quote.client.id,
        firstName: quote.client.firstName,
        lastName: quote.client.lastName,
        company: quote.client.company,
        billingMode: quote.client.billingMode,
        color: quote.client.color,
      },
      lines: quote.lines.map(serializeQuoteLine),
    }
    return NextResponse.json(detail)
  } catch (error) {
    return apiServerError(error)
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const existing = await prisma.quote.findFirst({
      where: { id, userId: user.id },
      select: { id: true, status: true, sentAt: true, decidedAt: true },
    })
    if (!existing) return apiNotFound()

    const body = await req.json()
    const partial = quoteUpdateSchema.partial().parse(body)
    const nextStatus = partial.status ?? existing.status

    const becomesSent = nextStatus !== "DRAFT" && existing.sentAt == null
    const becomesDecided =
      DECIDED_STATUSES.includes(nextStatus) &&
      !DECIDED_STATUSES.includes(existing.status)

    const totals =
      partial.lines != null
        ? sumLines(
            partial.lines.map((l) => ({
              qty: Number(l.qty),
              rate: Number(l.rate),
            })),
          )
        : null

    const updated = await prisma.$transaction(async (tx) => {
      if (partial.lines != null) {
        await tx.quoteLine.deleteMany({ where: { quoteId: id } })
      }
      return tx.quote.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(partial.projectId !== undefined
            ? { projectId: partial.projectId ?? null }
            : {}),
          ...(partial.number ? { number: partial.number.trim() } : {}),
          ...(partial.issueDate
            ? { issueDate: new Date(partial.issueDate) }
            : {}),
          ...(partial.validUntil !== undefined
            ? {
                validUntil: partial.validUntil
                  ? new Date(partial.validUntil)
                  : null,
              }
            : {}),
          ...(partial.notes !== undefined ? { notes: partial.notes } : {}),
          ...(partial.externalUrl !== undefined
            ? { externalUrl: partial.externalUrl ?? null }
            : {}),
          ...(totals != null ? { subtotal: totals, total: totals } : {}),
          ...(becomesSent ? { sentAt: new Date() } : {}),
          ...(becomesDecided ? { decidedAt: new Date() } : {}),
          ...(partial.lines != null
            ? {
                lines: {
                  create: partial.lines.map((l, i) => ({
                    taskId: l.taskId ?? null,
                    label: l.label,
                    qty: Number(l.qty),
                    rate: Number(l.rate),
                    position: i,
                  })),
                },
              }
            : {}),
        },
        include: { _count: { select: { lines: true } } },
      })
    })

    revalidateTag(navTag(user.id), "max")
    return NextResponse.json(serializeQuote(updated))
  } catch (error) {
    return apiServerError(error)
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const deleted = await prisma.quote.deleteMany({
      where: { id, userId: user.id },
    })
    if (deleted.count === 0) return apiNotFound()

    revalidateTag(navTag(user.id), "max")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
