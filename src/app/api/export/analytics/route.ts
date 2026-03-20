import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"
import {
  getMonthKey,
  fetchIssueMapForClient,
  computeGroupAmount,
  computeDateRange,
} from "@/lib/analytics-helpers"

import type { OverrideWithClient } from "@/lib/analytics-helpers"
import type { Client, LinearMapping } from "@/generated/prisma/client"

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCsv(
  rows: Array<Record<string, unknown>>,
  columns: string[],
): string {
  const header = columns.join(",")
  const body = rows.map((r) =>
    columns.map((col) => escapeCsvField(String(r[col] ?? ""))).join(","),
  )
  return [header, ...body].join("\n")
}

/**
 * GET /api/export/analytics
 * Exports analytics data (revenue by month/client, hours) as CSV or JSON.
 * Query params: `?format=csv|json&period=1m|3m|6m|12m|all`
 * @returns 200 - CSV or JSON file download
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const format = url.searchParams.get("format") ?? "csv"
    const period = url.searchParams.get("period") ?? "3m"

    const validPeriods = ["1m", "3m", "6m", "1y", "custom"]
    if (!validPeriods.includes(period)) {
      return apiError(
        "VAL_INVALID_PERIOD",
        `Invalid period. Must be one of: ${validPeriods.join(", ")}`,
        400,
      )
    }

    const { from, to } = computeDateRange(period, null, null)

    const overrides = await prisma.taskOverride.findMany({
      where: {
        invoiced: true,
        invoicedAt: { not: null, gte: from, lte: to },
        client: {
          userId: userOrError.id,
          archivedAt: null,
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

    // Group overrides by client and month
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

    // Build flat rows: month, client, category, revenue, hours
    const exportRows: Array<{
      month: string
      client: string
      category: string
      revenue: number
      hours: number
    }> = []

    for (const [clientId, monthsMap] of byClientMonth) {
      const client = clientMap.get(clientId)!
      const issueMap = issueMapByClient.get(clientId) ?? new Map()

      for (const [monthKey, monthOverrides] of monthsMap) {
        const { amount, hours } = computeGroupAmount(
          monthOverrides,
          issueMap,
          client,
        )

        exportRows.push({
          month: monthKey,
          client: client.name,
          category: client.category,
          revenue: Math.round(amount * 100) / 100,
          hours: Math.round(hours * 100) / 100,
        })
      }
    }

    // Sort by month descending, then client name
    exportRows.sort((a, b) => {
      const monthCmp = b.month.localeCompare(a.month)
      if (monthCmp !== 0) return monthCmp
      return a.client.localeCompare(b.client)
    })

    if (format === "json") {
      return new NextResponse(JSON.stringify(exportRows, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="analytics-${period}-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      })
    }

    const columns = ["month", "client", "category", "revenue", "hours"]
    const csv = toCsv(exportRows, columns)

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv"`,
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
