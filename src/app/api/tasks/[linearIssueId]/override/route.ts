import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { upsertTaskOverrideSchema } from "@/lib/schemas/task-override"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ linearIssueId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { linearIssueId } = await context.params
    const body = await request.json()
    const validated = upsertTaskOverrideSchema.parse(body)

    const client = await prisma.client.findFirst({
      where: { id: validated.clientId, userId: userOrError.id },
    })

    if (!client) {
      return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    }

    const data = {
      toInvoice: validated.toInvoice,
      invoiced: validated.invoiced,
      invoicedAt:
        validated.invoiced === true && !validated.invoicedAt
          ? new Date()
          : (validated.invoicedAt ?? undefined),
      rateOverride: validated.rateOverride,
    }

    const override = await prisma.taskOverride.upsert({
      where: { linearIssueId },
      create: {
        clientId: validated.clientId,
        linearIssueId,
        ...data,
      },
      update: data,
    })

    return NextResponse.json({
      ...override,
      rateOverride: override.rateOverride
        ? Number(override.rateOverride)
        : null,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
