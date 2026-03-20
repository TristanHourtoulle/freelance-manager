import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { categoryFilterField } from "@/lib/schemas/category-filter"
import { rateLimit } from "@/lib/rate-limit"
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

/** Valid section values for partial data fetching. */
type AnalyticsSection =
  | "revenue-by-month"
  | "revenue-by-client"
  | "hours-by-client"
  | "revenue-by-category"
  | "utilization"

const VALID_SECTIONS: ReadonlySet<string> = new Set<AnalyticsSection>([
  "revenue-by-month",
  "revenue-by-client",
  "hours-by-client",
  "revenue-by-category",
  "utilization",
])

/**
 * Checks whether a section should be computed based on the requested section filter.
 * When no section is specified, all sections are computed (backward compatible).
 */
function shouldCompute(
  requested: AnalyticsSection | null,
  target: AnalyticsSection,
): boolean {
  if (requested === null) return true
  // revenue-by-category depends on revenue-by-client data
  if (requested === "revenue-by-category") {
    return target === "revenue-by-client" || target === "revenue-by-category"
  }
  // hours-by-client is computed inside the revenue-by-client block
  if (requested === "hours-by-client") {
    return target === "revenue-by-client" || target === "hours-by-client"
  }
  // utilization depends on revenue-by-month data
  if (requested === "utilization") {
    return target === "revenue-by-month" || target === "utilization"
  }
  return target === requested
}

/**
 * GET /api/analytics
 * Returns analytics data. Supports an optional `section` query param to fetch
 * only a specific chart's data (revenue-by-month, revenue-by-client,
 * hours-by-client, revenue-by-category, utilization). When omitted, returns all
 * sections (backward compatible).
 * @returns 200 - Full or partial analytics payload
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid filter parameters
 */
export async function GET(request: Request) {
  try {
    const rl = rateLimit(request)
    if (!rl.success) {
      return NextResponse.json(
        {
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.reset / 1000)) },
        },
      )
    }

    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const period = url.searchParams.get("period") ?? "3m"
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")
    const categoryRaw = url.searchParams.get("category") ?? undefined
    const categoryFilter = categoryFilterField.parse(categoryRaw)
    const sectionParam = url.searchParams.get("section")

    if (sectionParam !== null && !VALID_SECTIONS.has(sectionParam)) {
      return apiError(
        "INVALID_SECTION",
        `Invalid section: ${sectionParam}. Valid values: ${[...VALID_SECTIONS].join(", ")}`,
        400,
      )
    }

    const section = sectionParam as AnalyticsSection | null

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

    const result: Record<string, unknown> = {}

    // IMPORTANT: Section evaluation order matters due to data dependencies.
    // 1. revenue-by-month (also populates monthHours for utilization)
    // 2. revenue-by-client + hours-by-client (also needed for revenue-by-category)
    // 3. revenue-by-category (depends on revenueByClient)
    // 4. utilization (depends on revenueByMonth + monthHours)
    // Do not reorder the blocks below without updating shouldCompute().

    // Revenue by month (also needed for utilization)
    let revenueByMonth: Array<{
      month: string
      label: string
      amount: number
    }> = []
    const monthHours = new Map<string, number>()

    if (shouldCompute(section, "revenue-by-month")) {
      revenueByMonth = buildMonthRange(from, to)
      const monthAmounts = new Map<string, number>()
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

      if (section === null || section === "revenue-by-month") {
        result.revenueByMonth = revenueByMonth
      }
    }

    // Revenue by client + hours by client (also needed for revenue-by-category)
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

    if (shouldCompute(section, "revenue-by-client")) {
      const byClient = new Map<string, OverrideWithClient[]>()
      for (const o of overrides) {
        const list = byClient.get(o.clientId) ?? []
        list.push(o)
        byClient.set(o.clientId, list)
      }

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

      revenueByClient.sort((a, b) => b.amount - a.amount)
      hoursByClient.sort((a, b) => b.hours - a.hours)

      if (section === null || section === "revenue-by-client") {
        result.revenueByClient = revenueByClient
      }
      if (section === null || section === "hours-by-client") {
        result.hoursByClient = hoursByClient
      }
    }

    // Revenue by category (depends on revenueByClient)
    if (shouldCompute(section, "revenue-by-category")) {
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

      result.revenueByCategory = revenueByCategory
    }

    // Utilization (depends on revenueByMonth + monthHours)
    if (shouldCompute(section, "utilization")) {
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId: userOrError.id },
      })
      const availableHoursPerMonth = userSettings?.availableHoursPerMonth ?? 140

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

      result.utilization = {
        availableHoursPerMonth,
        totalBilledHours: Math.round(totalBilledHours * 100) / 100,
        totalAvailableHours,
        rate: utilizationRate,
        byMonth: utilizationByMonth,
      }
    }

    return NextResponse.json(result)
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
