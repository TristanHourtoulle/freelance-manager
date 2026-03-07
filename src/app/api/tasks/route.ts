import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { taskFilterSchema } from "@/lib/schemas/task"
import { fetchLinearIssues, getLinearSyncStatus } from "@/lib/linear-service"
import { calculateBilling } from "@/lib/billing"
import { NextResponse } from "next/server"

import type { BillingMode, TaskOverride } from "@/generated/prisma/client"
import type {
  EnrichedTask,
  ClientTaskGroup,
  ClientSummary,
} from "@/components/tasks/types"

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const filters = taskFilterSchema.parse(params)

    const clients = await prisma.client.findMany({
      where: {
        userId: userOrError.id,
        archivedAt: null,
        ...(filters.clientId ? { id: filters.clientId } : {}),
        ...(filters.category ? { category: { in: filters.category } } : {}),
      },
      include: { linearMappings: true },
    })

    const clientsWithMappings = clients.filter(
      (c) => c.linearMappings.length > 0,
    )

    if (clientsWithMappings.length === 0) {
      return NextResponse.json({ groups: [] })
    }

    const clientIds = clientsWithMappings.map((c) => c.id)
    const allOverrides = await prisma.taskOverride.findMany({
      where: { clientId: { in: clientIds } },
    })
    const overrideMap = new Map<string, TaskOverride>(
      allOverrides.map((o) => [o.linearIssueId, o]),
    )

    const issuePromises = clientsWithMappings.flatMap((client) =>
      client.linearMappings.map(async (mapping) => {
        const issues = await fetchLinearIssues({
          teamId: mapping.linearTeamId ?? undefined,
          projectId: mapping.linearProjectId ?? undefined,
        })
        return { clientId: client.id, issues }
      }),
    )

    const results = await Promise.allSettled(issuePromises)

    const issuesByClient = new Map<
      string,
      Awaited<ReturnType<typeof fetchLinearIssues>>
    >()

    for (const result of results) {
      if (result.status !== "fulfilled") continue
      const { clientId, issues } = result.value
      const existing = issuesByClient.get(clientId) ?? []
      issuesByClient.set(clientId, [...existing, ...issues])
    }

    const groups: ClientTaskGroup[] = []

    for (const client of clientsWithMappings) {
      const rawIssues = issuesByClient.get(client.id) ?? []

      const seenIds = new Set<string>()
      const uniqueIssues = rawIssues.filter((issue) => {
        if (seenIds.has(issue.id)) return false
        seenIds.add(issue.id)
        return true
      })

      const filteredIssues = (() => {
        switch (filters.preset) {
          case "active":
            return uniqueIssues.filter(
              (i) => !["completed", "cancelled"].includes(i.status?.type ?? ""),
            )
          case "done":
            return uniqueIssues.filter((i) => i.status?.type === "completed")
          case "backlog":
            return uniqueIssues.filter((i) =>
              ["backlog", "unstarted"].includes(i.status?.type ?? ""),
            )
          default:
            return uniqueIssues
        }
      })()

      const billingMode = client.billingMode as BillingMode
      const rate = Number(client.rate)

      let tasks: EnrichedTask[] = filteredIssues.map((issue) => {
        const override = overrideMap.get(issue.id)
        const rateOverride = override?.rateOverride
          ? Number(override.rateOverride)
          : null

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
          toInvoice: override?.toInvoice ?? false,
          invoiced: override?.invoiced ?? false,
          rateOverride,
        }
      })

      if (filters.preset === "to-invoice") {
        tasks = tasks.filter((t) => t.toInvoice && !t.invoiced)
      }

      const totalBilling =
        billingMode === "FIXED"
          ? tasks.some((t) => t.toInvoice)
            ? rate
            : 0
          : tasks
              .filter((t) => t.toInvoice)
              .reduce((sum, t) => sum + t.billingAmount, 0)

      const clientSummary: ClientSummary = {
        id: client.id,
        name: client.name,
        company: client.company,
        billingMode: client.billingMode,
        rate,
      }

      groups.push({
        client: clientSummary,
        tasks,
        totalBilling: Math.round(totalBilling * 100) / 100,
        taskCount: tasks.length,
      })
    }

    groups.sort((a, b) => b.taskCount - a.taskCount)

    return NextResponse.json({ groups, ...getLinearSyncStatus() })
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
