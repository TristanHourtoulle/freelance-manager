import { NextResponse } from "next/server"
import {
  getAuthenticatedUser,
  apiError,
  handleApiError,
  isLinearError,
} from "@/lib/api-utils"
import { prisma } from "@/lib/db"
import { fetchLinearIssueById } from "@/lib/linear-service"
import { calculateBilling } from "@/lib/billing"

import type { BillingMode } from "@/generated/prisma/client"

/**
 * GET /api/linear/issues/:id
 * Fetches a single Linear issue with its override, billing calculation, and
 * associated client information.
 * @returns 200 - `{ issue, override, billing, client }`
 * @throws 401 - Unauthenticated request
 * @throws 403 - Issue override belongs to another user
 * @throws 502 - Linear API error
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await params

    const issue = await fetchLinearIssueById(id)

    const override = await prisma.taskOverride.findUnique({
      where: { linearIssueId: id },
      include: { client: true },
    })

    if (override && override.client.userId !== userOrError.id) {
      return apiError("AUTH_FORBIDDEN", "Access denied", 403)
    }

    const client = override
      ? override.client
      : await findClientForIssue(issue.teamId, issue.projectId, userOrError.id)

    const rateOverride = override?.rateOverride
      ? Number(override.rateOverride)
      : null

    const billing = client
      ? calculateBilling({
          billingMode: client.billingMode as BillingMode,
          rate: Number(client.rate),
          estimate: issue.estimate,
          rateOverride,
        })
      : null

    return NextResponse.json({
      issue,
      override: override
        ? {
            linearIssueId: override.linearIssueId,
            toInvoice: override.toInvoice,
            invoiced: override.invoiced,
            invoicedAt: override.invoicedAt?.toISOString() ?? null,
            rateOverride,
          }
        : null,
      billing,
      client: client
        ? {
            id: client.id,
            name: client.name,
            billingMode: client.billingMode,
            rate: Number(client.rate),
          }
        : null,
    })
  } catch (error) {
    if (isLinearError(error)) {
      return apiError(
        "LINEAR_ISSUE_FETCH_FAILED",
        "Failed to fetch Linear issue",
        502,
      )
    }
    return handleApiError(error)
  }
}

async function findClientForIssue(
  teamId: string | undefined,
  projectId: string | undefined,
  userId: string,
) {
  if (!teamId && !projectId) return null

  const mapping = await prisma.linearMapping.findFirst({
    where: {
      client: { userId },
      ...(projectId
        ? { linearProjectId: projectId }
        : { linearTeamId: teamId }),
    },
    include: { client: true },
  })

  return mapping?.client ?? null
}
