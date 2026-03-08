import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { calculateBilling } from "@/lib/billing"
import { markInvoicedSchema } from "@/lib/schemas/billing"
import { NextResponse } from "next/server"

import type { BillingMode } from "@/generated/prisma/client"

/**
 * POST /api/billing/mark-invoiced
 * Marks a batch of tasks as invoiced by their Linear issue IDs.
 * Also creates or updates Invoice records per client/month with status SENT.
 * @returns 200 - `{ markedCount: number }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid request body (missing linearIssueIds)
 * @throws 403 - Attempting to mark tasks owned by another user
 */
export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body = await request.json()
    const validated = markInvoicedSchema.parse(body)

    const overrides = await prisma.taskOverride.findMany({
      where: {
        linearIssueId: { in: validated.linearIssueIds },
        toInvoice: true,
        invoiced: false,
      },
      include: {
        client: {
          select: {
            userId: true,
            id: true,
            billingMode: true,
            rate: true,
          },
        },
      },
    })

    const unauthorized = overrides.filter(
      (o) => o.client.userId !== userOrError.id,
    )
    if (unauthorized.length > 0) {
      return apiError(
        "AUTH_FORBIDDEN",
        "Not authorized to mark these tasks",
        403,
      )
    }

    const validIds = overrides.map((o) => o.linearIssueId)

    if (validIds.length === 0) {
      return NextResponse.json({ markedCount: 0 })
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    await prisma.$transaction(async (tx) => {
      await tx.taskOverride.updateMany({
        where: { linearIssueId: { in: validIds } },
        data: {
          invoiced: true,
          invoicedAt: now,
        },
      })

      const clientTotals = new Map<string, number>()
      for (const override of overrides) {
        const billing = calculateBilling({
          billingMode: override.client.billingMode as BillingMode,
          rate: Number(override.client.rate),
          estimate: undefined,
          rateOverride: override.rateOverride
            ? Number(override.rateOverride)
            : null,
        })
        const current = clientTotals.get(override.clientId) ?? 0
        clientTotals.set(override.clientId, current + billing.amount)
      }

      for (const [clientId, amount] of clientTotals) {
        await tx.invoice.upsert({
          where: {
            clientId_month: { clientId, month: monthStart },
          },
          create: {
            clientId,
            month: monthStart,
            totalAmount: amount,
            status: "SENT",
          },
          update: {
            totalAmount: { increment: amount },
            status: "SENT",
          },
        })
      }
    })

    return NextResponse.json({ markedCount: validIds.length })
  } catch (error) {
    return handleApiError(error)
  }
}
