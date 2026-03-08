import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { categoryFilterField } from "@/lib/schemas/category-filter"
import { NextResponse } from "next/server"
import {
  getMonthKey,
  buildMonthRange,
  fetchIssueMapForClient,
  computeGroupAmount,
  computeDateRange,
  buildUtilizationByMonth,
} from "@/lib/analytics-helpers"

import type { OverrideWithClient } from "@/lib/analytics-helpers"
import type { Client, LinearMapping } from "@/generated/prisma/client"

/**
 * GET /api/analytics
 * Returns analytics data: revenue by month, by client, by category, hours by
 * client, and utilization metrics over the requested period.
 * @returns 200 - `{ revenueByMonth, revenueByClient, hoursByClient, revenueByCategory, utilization }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid filter parameters
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const period = url.searchParams.get("period") ?? "3m"
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")
    const categoryRaw = url.searchParams.get("category") ?? undefined
    const categoryFilter = categoryFilterField.parse(categoryRaw)

    const { from, to } = computeDateRange(period, fromParam, toParam)

    const overrides = await prisma.taskOverride.findMany({
      where: {
        invoiced: true,
        invoicedAt: { not: null, gte: from, lte: to },
        client: {
          userId: userOrError.id,
          archivedAt: null,
          ...(categoryFilter ? { category: { in: categoryFilter } } : {}),
        },
      },
      include: {
        client: { include: { linearMappings: true } },
      },
    })

    // Build client map and fetch Linear issues
    const clientMap = new Map<
      string,
      Client & { linearMappings: LinearMapping[] }
    >()
    for (const o of overrides) {
      if (!clientMap.has(o.clientId)) {
        clientMap.set(o.clientId, o.client)
      }
    }

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

    // Fetch user settings for utilization calculation
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: userOrError.id },
    })
    const availableHoursPerMonth = userSettings?.availableHoursPerMonth ?? 140

    // Revenue by month
    const revenueByMonth = buildMonthRange(from, to)
    const monthAmounts = new Map<string, number>()
    const monthHours = new Map<string, number>()
    const byClientMonth = new Map<string, Map<string, OverrideWithClient[]>>()

    for (const o of overrides) {
      if (!o.invoicedAt) continue
      const monthKey = getMonthKey(o.invoicedAt)

      if (!byClientMonth.has(o.clientId)) {
        byClientMonth.set(o.clientId, new Map())
      }
      const clientMonths = byClientMonth.get(o.clientId)!
      const list = clientMonths.get(monthKey) ?? []
      list.push(o)
      clientMonths.set(monthKey, list)
    }

    for (const [clientId, monthsMap] of byClientMonth) {
      const client = clientMap.get(clientId)!
      const issueMap = issueMapByClient.get(clientId) ?? new Map()

      for (const [monthKey, monthOverrides] of monthsMap) {
        const { amount, hours } = computeGroupAmount(
          monthOverrides,
          issueMap,
          client,
        )
        monthAmounts.set(monthKey, (monthAmounts.get(monthKey) ?? 0) + amount)
        monthHours.set(monthKey, (monthHours.get(monthKey) ?? 0) + hours)
      }
    }

    for (const entry of revenueByMonth) {
      entry.amount =
        Math.round((monthAmounts.get(entry.month) ?? 0) * 100) / 100
    }

    // Revenue by client + hours by client
    const byClient = new Map<string, OverrideWithClient[]>()
    for (const o of overrides) {
      const list = byClient.get(o.clientId) ?? []
      list.push(o)
      byClient.set(o.clientId, list)
    }

    const revenueByClient: Array<{
      clientId: string
      clientName: string
      amount: number
    }> = []
    const hoursByClient: Array<{
      clientId: string
      clientName: string
      hours: number
    }> = []

    for (const [clientId, clientOverrides] of byClient) {
      const client = clientMap.get(clientId)!
      const issueMap = issueMapByClient.get(clientId) ?? new Map()
      const { amount, hours } = computeGroupAmount(
        clientOverrides,
        issueMap,
        client,
      )

      revenueByClient.push({
        clientId,
        clientName: client.name,
        amount: Math.round(amount * 100) / 100,
      })

      hoursByClient.push({
        clientId,
        clientName: client.name,
        hours,
      })
    }

    // Sort by amount/hours descending
    revenueByClient.sort((a, b) => b.amount - a.amount)
    hoursByClient.sort((a, b) => b.hours - a.hours)

    // Revenue by category
    const categoryLabels: Record<string, string> = {
      FREELANCE: "Freelance",
      STUDY: "Study",
      PERSONAL: "Personal",
      SIDE_PROJECT: "Side Project",
    }

    const categoryAmounts = new Map<string, number>()
    for (const entry of revenueByClient) {
      const client = clientMap.get(entry.clientId)!
      const cat = client.category
      categoryAmounts.set(cat, (categoryAmounts.get(cat) ?? 0) + entry.amount)
    }

    const revenueByCategory = Object.entries(categoryLabels)
      .map(([category, label]) => ({
        category,
        label,
        amount: Math.round((categoryAmounts.get(category) ?? 0) * 100) / 100,
      }))
      .filter((entry) => entry.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    // Utilization
    const utilizationByMonth = buildUtilizationByMonth(
      revenueByMonth,
      monthHours,
      availableHoursPerMonth,
    )
    const totalBilledHours = utilizationByMonth.reduce(
      (sum, m) => sum + m.billedHours,
      0,
    )
    const totalAvailableHours =
      utilizationByMonth.length * availableHoursPerMonth
    const utilizationRate =
      totalAvailableHours > 0
        ? Math.round((totalBilledHours / totalAvailableHours) * 10000) / 100
        : 0

    return NextResponse.json({
      revenueByMonth,
      revenueByClient,
      hoursByClient,
      revenueByCategory,
      utilization: {
        availableHoursPerMonth,
        totalBilledHours: Math.round(totalBilledHours * 100) / 100,
        totalAvailableHours,
        rate: utilizationRate,
        byMonth: utilizationByMonth,
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
