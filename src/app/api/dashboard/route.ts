import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { fetchLinearIssues } from "@/lib/linear-service"
import { calculateBilling } from "@/lib/billing"
import { NextResponse } from "next/server"

import type {
  BillingMode,
  TaskOverride,
  Client,
  LinearMapping,
} from "@/generated/prisma/client"

type OverrideWithClient = TaskOverride & {
  client: Client & { linearMappings: LinearMapping[] }
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

function getMonthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function getMonthLabel(key: string): string {
  const month = parseInt(key.split("-")[1]!, 10)
  return MONTH_LABELS[month - 1]!
}

function buildLast6Months(): Array<{
  month: string
  label: string
  amount: number
}> {
  const now = new Date()
  const result: Array<{ month: string; label: string; amount: number }> = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = getMonthKey(d)
    result.push({ month: key, label: getMonthLabel(key), amount: 0 })
  }

  return result
}

async function fetchIssueMapForClient(
  client: Client & { linearMappings: LinearMapping[] },
): Promise<Map<string, { estimate: number | undefined }>> {
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

  return new Map(allIssues.map((i) => [i.id, { estimate: i.estimate }]))
}

function computeGroupAmount(
  overrides: OverrideWithClient[],
  issueMap: Map<string, { estimate: number | undefined }>,
  client: Client,
): { amount: number; hours: number } {
  const billingMode = client.billingMode as BillingMode
  const rate = Number(client.rate)

  let totalAmount = 0
  let totalHours = 0

  if (billingMode === "FIXED") {
    totalAmount = overrides.length > 0 ? rate : 0
  } else {
    for (const override of overrides) {
      const issue = issueMap.get(override.linearIssueId)
      const estimate = issue?.estimate
      const rateOverride = override.rateOverride
        ? Number(override.rateOverride)
        : null

      const billing = calculateBilling({
        billingMode,
        rate,
        estimate,
        rateOverride,
      })

      totalAmount += billing.amount

      if (estimate !== undefined) {
        totalHours += estimate
      }
    }
  }

  return {
    amount: Math.round(totalAmount * 100) / 100,
    hours: totalHours,
  }
}

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const baseClientWhere = {
      userId: userOrError.id,
      archivedAt: null,
    }

    const [pipelineOverrides, invoicedOverrides] = await Promise.all([
      prisma.taskOverride.findMany({
        where: {
          toInvoice: true,
          invoiced: false,
          client: baseClientWhere,
        },
        include: {
          client: { include: { linearMappings: true } },
        },
      }),
      prisma.taskOverride.findMany({
        where: {
          invoiced: true,
          invoicedAt: { not: null, gte: sixMonthsAgo },
          client: baseClientWhere,
        },
        include: {
          client: { include: { linearMappings: true } },
        },
      }),
    ])

    // Collect all unique clients that need Linear issue fetching
    const clientMap = new Map<
      string,
      Client & { linearMappings: LinearMapping[] }
    >()
    for (const o of [...pipelineOverrides, ...invoicedOverrides]) {
      if (!clientMap.has(o.clientId)) {
        clientMap.set(o.clientId, o.client)
      }
    }

    // Fetch Linear issues once per client
    const issueMapByClient = new Map<
      string,
      Map<string, { estimate: number | undefined }>
    >()
    const fetchPromises = [...clientMap.entries()].map(
      async ([clientId, client]) => {
        const issueMap = await fetchIssueMapForClient(client)
        issueMapByClient.set(clientId, issueMap)
      },
    )
    await Promise.allSettled(fetchPromises)

    // Pipeline: toInvoice=true, invoiced=false
    let pipeline = 0
    const pipelineByClient = new Map<string, OverrideWithClient[]>()
    for (const o of pipelineOverrides) {
      const list = pipelineByClient.get(o.clientId) ?? []
      list.push(o)
      pipelineByClient.set(o.clientId, list)
    }
    for (const [clientId, overrides] of pipelineByClient) {
      const client = clientMap.get(clientId)!
      const issueMap = issueMapByClient.get(clientId) ?? new Map()
      const { amount } = computeGroupAmount(overrides, issueMap, client)
      pipeline += amount
    }

    // Monthly revenue + billed hours: invoiced=true, invoicedAt in current month
    let monthlyRevenue = 0
    let billedHours = 0
    const monthlyByClient = new Map<string, OverrideWithClient[]>()
    for (const o of invoicedOverrides) {
      if (
        o.invoicedAt &&
        o.invoicedAt >= firstOfMonth &&
        o.invoicedAt < firstOfNextMonth
      ) {
        const list = monthlyByClient.get(o.clientId) ?? []
        list.push(o)
        monthlyByClient.set(o.clientId, list)
      }
    }
    for (const [clientId, overrides] of monthlyByClient) {
      const client = clientMap.get(clientId)!
      const issueMap = issueMapByClient.get(clientId) ?? new Map()
      const { amount, hours } = computeGroupAmount(overrides, issueMap, client)
      monthlyRevenue += amount
      billedHours += hours
    }

    // 6-month chart: aggregate invoiced amounts by month
    const revenueByMonth = buildLast6Months()
    const monthAmounts = new Map<string, number>()
    const chartByClientMonth = new Map<
      string,
      Map<string, OverrideWithClient[]>
    >()

    for (const o of invoicedOverrides) {
      if (!o.invoicedAt) continue
      const monthKey = getMonthKey(o.invoicedAt)

      if (!chartByClientMonth.has(o.clientId)) {
        chartByClientMonth.set(o.clientId, new Map())
      }
      const clientMonths = chartByClientMonth.get(o.clientId)!
      const list = clientMonths.get(monthKey) ?? []
      list.push(o)
      clientMonths.set(monthKey, list)
    }

    for (const [clientId, monthsMap] of chartByClientMonth) {
      const client = clientMap.get(clientId)!
      const issueMap = issueMapByClient.get(clientId) ?? new Map()

      for (const [monthKey, overrides] of monthsMap) {
        const { amount } = computeGroupAmount(overrides, issueMap, client)
        monthAmounts.set(monthKey, (monthAmounts.get(monthKey) ?? 0) + amount)
      }
    }

    for (const entry of revenueByMonth) {
      entry.amount =
        Math.round((monthAmounts.get(entry.month) ?? 0) * 100) / 100
    }

    return NextResponse.json({
      pipeline: Math.round(pipeline * 100) / 100,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
      billedHours,
      revenueByMonth,
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
