import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { historyFilterSchema } from "@/lib/schemas/billing"
import { fetchLinearIssues } from "@/lib/linear-service"
import { calculateBilling } from "@/lib/billing"
import { getMonthKey, getFullMonthLabel } from "@/lib/analytics-helpers"
import { NextResponse } from "next/server"

import type {
  BillingMode,
  TaskOverride,
  Client,
  LinearMapping,
} from "@/generated/prisma/client"
import type { EnrichedTask, ClientSummary } from "@/components/tasks/types"
import type {
  HistoryMonthGroup,
  HistoryClientGroup,
} from "@/components/billing/types"

type OverrideWithClient = TaskOverride & {
  client: Client & { linearMappings: LinearMapping[] }
}

/**
 * GET /api/billing/history
 * Returns invoiced tasks grouped by month and client, with totals.
 * Defaults to the last 6 months if no date range is provided.
 * @returns 200 - `{ months: HistoryMonthGroup[], grandTotal }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid filter parameters
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const filters = historyFilterSchema.parse(params)

    const now = new Date()
    const dateFrom =
      filters.dateFrom ?? new Date(now.getFullYear(), now.getMonth() - 6, 1)
    const dateTo = filters.dateTo ?? now

    const overrides = await prisma.taskOverride.findMany({
      where: {
        invoiced: true,
        invoicedAt: { not: null, gte: dateFrom, lte: dateTo },
        client: {
          userId: userOrError.id,
          archivedAt: null,
          ...(filters.clientId ? { id: filters.clientId } : {}),
        },
      },
      include: {
        client: {
          include: { linearMappings: true },
        },
      },
    })

    if (overrides.length === 0) {
      return NextResponse.json({ months: [], grandTotal: 0 })
    }

    const typedOverrides = overrides as OverrideWithClient[]

    const uniqueClients = new Map<
      string,
      Client & { linearMappings: LinearMapping[] }
    >()
    for (const override of typedOverrides) {
      if (!uniqueClients.has(override.clientId)) {
        uniqueClients.set(override.clientId, override.client)
      }
    }

    const issueMapByClient = new Map<
      string,
      Map<
        string,
        {
          id: string
          identifier: string
          title: string
          estimate: number | undefined
          status:
            | { id: string; name: string; type: string; color: string }
            | undefined
          url: string
          priorityLabel: string
        }
      >
    >()

    await Promise.all(
      [...uniqueClients.entries()].map(async ([clientId, client]) => {
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
        const issueMap = new Map(
          allIssues.map((i) => [
            i.id,
            {
              id: i.id,
              identifier: i.identifier,
              title: i.title,
              estimate: i.estimate,
              status: i.status
                ? {
                    id: i.status.id,
                    name: i.status.name,
                    type: i.status.type,
                    color: i.status.color,
                  }
                : undefined,
              url: i.url,
              priorityLabel: i.priorityLabel,
            },
          ]),
        )
        issueMapByClient.set(clientId, issueMap)
      }),
    )

    const invoices = await prisma.invoice.findMany({
      where: {
        client: { userId: userOrError.id },
        month: { gte: dateFrom, lte: dateTo },
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
      },
      include: {
        files: {
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: "desc" },
        },
      },
    })
    const invoiceMap = new Map(
      invoices.map((inv) => [
        `${inv.clientId}-${getMonthKey(inv.month)}`,
        {
          id: inv.id,
          status: inv.status,
          totalAmount: Number(inv.totalAmount),
          paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
          paymentDueDate: inv.paymentDueDate
            ? inv.paymentDueDate.toISOString()
            : null,
          files: inv.files.map((f) => ({
            id: f.id,
            fileName: f.fileName,
            fileSize: f.fileSize,
            uploadedAt: f.uploadedAt.toISOString(),
          })),
        },
      ]),
    )

    const monthClientMap = new Map<string, Map<string, OverrideWithClient[]>>()

    for (const override of typedOverrides) {
      const monthKey = getMonthKey(override.invoicedAt!)
      if (!monthClientMap.has(monthKey)) {
        monthClientMap.set(monthKey, new Map())
      }
      const clientMap = monthClientMap.get(monthKey)!
      if (!clientMap.has(override.clientId)) {
        clientMap.set(override.clientId, [])
      }
      clientMap.get(override.clientId)!.push(override)
    }

    const months: HistoryMonthGroup[] = []

    for (const [monthKey, clientMap] of monthClientMap) {
      const clientGroups: HistoryClientGroup[] = []

      for (const [clientId, clientOverrides] of clientMap) {
        const client = uniqueClients.get(clientId)!
        const issueMap = issueMapByClient.get(clientId) ?? new Map()
        const billingMode = client.billingMode as BillingMode
        const rate = Number(client.rate)

        const invoiceKey = `${clientId}-${monthKey}`
        const invoiceData = invoiceMap.get(invoiceKey)
        const isPaid = invoiceData?.status === "PAID"

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
              projectName: undefined,
              toInvoice: true,
              invoiced: true,
              paid: isPaid,
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
            status: issue.status,
            url: issue.url,
            priorityLabel: issue.priorityLabel,
            billingAmount: billing.amount,
            billingFormula: billing.formula,
            projectName: issue.projectName,
            toInvoice: true,
            invoiced: true,
            paid: isPaid,
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

        clientGroups.push({
          client: clientSummary,
          tasks,
          totalBilling: Math.round(totalBilling * 100) / 100,
          taskCount: tasks.length,
          invoice: invoiceData,
        })
      }

      clientGroups.sort((a, b) => b.totalBilling - a.totalBilling)

      const monthTotal = clientGroups.reduce(
        (sum, g) => sum + g.totalBilling,
        0,
      )
      const taskCount = clientGroups.reduce((sum, g) => sum + g.taskCount, 0)

      months.push({
        month: monthKey,
        label: getFullMonthLabel(monthKey),
        clients: clientGroups,
        monthTotal: Math.round(monthTotal * 100) / 100,
        taskCount,
      })
    }

    months.sort((a, b) => b.month.localeCompare(a.month))

    const grandTotal = months.reduce((sum, m) => sum + m.monthTotal, 0)

    return NextResponse.json({
      months,
      grandTotal: Math.round(grandTotal * 100) / 100,
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
