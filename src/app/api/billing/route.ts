import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { billingFilterSchema } from "@/lib/schemas/billing"
import { fetchLinearIssues } from "@/lib/linear-service"
import { calculateBilling } from "@/lib/billing"
import { NextResponse } from "next/server"

import type {
  BillingMode,
  TaskOverride,
  Client,
  LinearMapping,
} from "@/generated/prisma/client"
import type {
  EnrichedTask,
  ClientTaskGroup,
  ClientSummary,
} from "@/components/tasks/types"

type OverrideWithClient = TaskOverride & {
  client: Client & { linearMappings: LinearMapping[] }
}

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const filters = billingFilterSchema.parse(params)

    const overrides = await prisma.taskOverride.findMany({
      where: {
        toInvoice: true,
        invoiced: false,
        client: {
          userId: userOrError.id,
          archivedAt: null,
          ...(filters.clientId ? { id: filters.clientId } : {}),
          ...(filters.category ? { category: { in: filters.category } } : {}),
        },
        ...(filters.dateFrom || filters.dateTo
          ? {
              updatedAt: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
      },
      include: {
        client: {
          include: { linearMappings: true },
        },
      },
    })

    if (overrides.length === 0) {
      return NextResponse.json({
        groups: [],
        grandTotal: 0,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: 0,
          totalPages: 0,
        },
      })
    }

    const overridesByClient = new Map<string, OverrideWithClient[]>()
    for (const override of overrides) {
      const list = overridesByClient.get(override.clientId) ?? []
      list.push(override)
      overridesByClient.set(override.clientId, list)
    }

    const allGroups: ClientTaskGroup[] = []

    for (const [clientId, clientOverrides] of overridesByClient) {
      const firstOverride = clientOverrides[0]
      if (!firstOverride) continue
      const client = firstOverride.client

      const issuePromises = client.linearMappings.map((mapping) =>
        fetchLinearIssues({
          teamId: mapping.linearTeamId ?? undefined,
          projectId: mapping.linearProjectId ?? undefined,
        }),
      )

      const issueResults = await Promise.allSettled(issuePromises)
      const allIssues = issueResults.flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      )

      const issueMap = new Map(allIssues.map((i) => [i.id, i]))

      const billingMode = client.billingMode as BillingMode
      const rate = Number(client.rate)

      const tasks: EnrichedTask[] = clientOverrides.map((override) => {
        const issue = issueMap.get(override.linearIssueId)
        const rateOverride = override.rateOverride
          ? Number(override.rateOverride)
          : null

        if (!issue) {
          return {
            linearIssueId: override.linearIssueId,
            identifier: "Unknown",
            title: "Issue not found in Linear",
            estimate: undefined,
            status: undefined,
            url: "",
            priorityLabel: "None",
            billingAmount: 0,
            billingFormula: "Unknown issue",
            toInvoice: true,
            invoiced: false,
            rateOverride,
          }
        }

        const billing = calculateBilling({
          billingMode,
          rate,
          estimate: issue.estimate,
          rateOverride,
        })

        return {
          linearIssueId: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          estimate: issue.estimate,
          status: issue.status
            ? {
                name: issue.status.name,
                type: issue.status.type,
                color: issue.status.color,
              }
            : undefined,
          url: issue.url,
          priorityLabel: issue.priorityLabel,
          billingAmount: billing.amount,
          billingFormula: billing.formula,
          toInvoice: true,
          invoiced: false,
          rateOverride,
        }
      })

      const totalBilling =
        billingMode === "FIXED"
          ? rate
          : tasks.reduce((sum, t) => sum + t.billingAmount, 0)

      const clientSummary: ClientSummary = {
        id: clientId,
        name: client.name,
        company: client.company,
        billingMode: client.billingMode,
        rate,
      }

      allGroups.push({
        client: clientSummary,
        tasks,
        totalBilling: Math.round(totalBilling * 100) / 100,
        taskCount: tasks.length,
      })
    }

    allGroups.sort((a, b) => b.totalBilling - a.totalBilling)

    const total = allGroups.length
    const totalPages = Math.ceil(total / filters.limit)
    const start = (filters.page - 1) * filters.limit
    const paginatedGroups = allGroups.slice(start, start + filters.limit)

    const grandTotal = allGroups.reduce((sum, g) => sum + g.totalBilling, 0)

    return NextResponse.json({
      groups: paginatedGroups,
      grandTotal: Math.round(grandTotal * 100) / 100,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("LINEAR_API_TOKEN")) {
      return apiError(
        "LINEAR_NOT_CONFIGURED",
        "Linear API token is not configured",
        503,
      )
    }
    return handleApiError(error)
  }
}
