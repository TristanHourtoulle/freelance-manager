import "server-only"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import {
  computeDashboardKpis,
  type PaymentBucketRow,
  type PaymentTotalsRow,
} from "@/domain/billing/kpis"
import { PIPELINE_TASK_WHERE } from "@/domain/tasks/billability"
import {
  aggregateDaysByClient,
  computeEffectiveRate,
} from "@/domain/analytics/effective-rate"
import { buildConcentration } from "@/domain/analytics/concentration"
import { computeQuoteKpis } from "@/domain/quotes/kpis"
import {
  NAME_MAX_CHARS,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  truncateText,
} from "@/lib/mcp/tools/common"
import {
  computeSyncFreshness,
  syncFreshnessOutputShape,
} from "@/lib/mcp/tools/sync-freshness"

const getDashboardInput = z.object({})

const getDashboardOutput = z.object({
  kpi: z.object({
    revenueMonth: z.number(),
    revenueYear: z.number(),
    paidCount: z.number(),
    paidCountMonth: z.number(),
    paidCountYear: z.number(),
    outstanding: z.number(),
    sentCount: z.number(),
    overdueAmount: z.number(),
    overdueCount: z.number(),
    pipelineCount: z.number(),
    pipelineEur: z.number(),
    pipelineClientCount: z.number(),
    unestimatedCount: z.number(),
  }),
  months: z.array(
    z.object({
      month: z.string(),
      total: z.number(),
      isCurrent: z.boolean(),
    }),
  ),
  overdue: z.array(
    z.object({
      id: z.string(),
      number: z.string(),
      clientId: z.string(),
      total: z.number(),
      dueDate: z.string(),
    }),
  ),
  ...syncFreshnessOutputShape,
})

const RANGE_MONTHS = { "3m": 3, "6m": 6, "12m": 12 } as const

const getAnalyticsInput = z.object({
  range: z.enum(["3m", "6m", "12m"]).default("12m"),
})

const getAnalyticsOutput = z.object({
  range: z.enum(["3m", "6m", "12m"]),
  months: z.array(
    z.object({
      label: z.string(),
      paid: z.number(),
      issued: z.number(),
      isCurrent: z.boolean(),
    }),
  ),
  kpi: z.object({
    totalRevenue: z.number(),
    avgRevenue: z.number(),
    trend: z.number(),
    runRate: z.number(),
    paidCount: z.number(),
    avgDelay: z.number(),
    avgInvoice: z.number(),
    collectionRate: z.number(),
    winRate: z.number(),
    avgDecisionDays: z.number(),
  }),
  byClient: z.array(
    z.object({
      clientId: z.string(),
      name: z.string(),
      revenue: z.number(),
      days: z.number(),
      effectiveRate: z.number().nullable(),
      revenueShare: z.number().nullable(),
      daysShare: z.number().nullable(),
    }),
  ),
  byType: z.array(
    z.object({
      type: z.enum(["DAILY", "FIXED", "HOURLY"]),
      revenue: z.number(),
    }),
  ),
  concentration: z.object({
    totalRevenue: z.number(),
    totalDays: z.number(),
    topClientShare: z.number().nullable(),
    topThreeShare: z.number().nullable(),
    level: z.enum(["ok", "warn", "danger"]),
  }),
})

type GetAnalyticsArgs = z.output<typeof getAnalyticsInput>

/**
 * Handler for the get_dashboard tool: the billing KPI snapshot.
 *
 * Runs the same aggregate queries as the dashboard page and folds them with
 * the canonical `computeDashboardKpis`, but performs no writes — unlike the
 * page, it never sweeps relances, so it is a pure read.
 *
 * @param userId - The resolved MCP principal.
 * @returns KPI figures, monthly revenue buckets and overdue invoices.
 */
export async function getDashboard(userId: string): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "get_dashboard", args: {} }, async () => {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const yearStart = new Date(today.getFullYear(), 0, 1)
    const chartStart = new Date(today.getFullYear(), today.getMonth() - 7, 1)

    const [
      openInvoices,
      paymentTotals,
      paymentBuckets,
      pipelineTasks,
      settings,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          userId,
          status: "SENT",
          paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
        },
        select: {
          id: true,
          number: true,
          clientId: true,
          status: true,
          paymentStatus: true,
          total: true,
          dueDate: true,
          payments: { select: { amount: true, paidAt: true } },
        },
      }),
      prisma.$queryRaw<PaymentTotalsRow[]>`
          SELECT
            COUNT(*)::bigint AS paid_count,
            COUNT(*) FILTER (WHERE "paidAt" >= ${monthStart})::bigint AS paid_count_month,
            COUNT(*) FILTER (WHERE "paidAt" >= ${yearStart})::bigint AS paid_count_year,
            COALESCE(SUM(amount) FILTER (WHERE "paidAt" >= ${monthStart}), 0)::float AS revenue_month,
            COALESCE(SUM(amount) FILTER (WHERE "paidAt" >= ${yearStart}), 0)::float AS revenue_year
          FROM payments
          WHERE "userId" = ${userId}
        `,
      prisma.$queryRaw<PaymentBucketRow[]>`
          SELECT
            date_trunc('month', "paidAt") AS month,
            SUM(amount)::float AS total
          FROM payments
          WHERE "userId" = ${userId} AND "paidAt" >= ${chartStart}
          GROUP BY 1
          ORDER BY 1
        `,
      prisma.task.findMany({
        where: PIPELINE_TASK_WHERE(userId),
        select: {
          clientId: true,
          estimate: true,
          completedAt: true,
          client: { select: { billingMode: true, rate: true } },
        },
      }),
      prisma.userSettings.findUnique({
        where: { userId },
        select: { linearLastSyncedAt: true },
      }),
    ])

    const { kpi, months, overdue } = computeDashboardKpis({
      now: today,
      openInvoices,
      paymentTotals,
      paymentBuckets,
      pipelineTasks: pipelineTasks.map((task) => ({
        clientId: task.clientId,
        estimate: task.estimate,
        billingMode: task.client.billingMode,
        rate: task.client.rate,
        completedAt: task.completedAt,
      })),
      recentInvoices: [],
    })

    return {
      kpi,
      months,
      overdue,
      ...computeSyncFreshness(settings?.linearLastSyncedAt ?? null),
    }
  })
}

interface MonthBucketRow {
  month: Date
  total: number
}

/**
 * Handler for the get_analytics tool: period revenue analytics.
 *
 * Reuses the canonical domain folds (`aggregateDaysByClient`,
 * `computeEffectiveRate`, `buildConcentration`, `computeQuoteKpis`) over the
 * requested period. `byClient` is truncated to the top 5 clients by revenue,
 * but shares and totals are computed over the whole book of business.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated range argument (3m, 6m or 12m).
 * @returns Monthly buckets, KPI figures, top clients and concentration.
 */
export async function getAnalytics(
  userId: string,
  args: GetAnalyticsArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "get_analytics", args }, async () => {
    const months = RANGE_MONTHS[args.range]
    const today = new Date()
    const periodStart = new Date(
      today.getFullYear(),
      today.getMonth() - (months - 1),
      1,
    )

    const [
      invoices,
      payments,
      clients,
      tasks,
      quotes,
      paidByMonth,
      issuedByMonth,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: { userId, status: { not: "CANCELLED" } },
        select: {
          id: true,
          clientId: true,
          status: true,
          paymentStatus: true,
          issueDate: true,
        },
      }),
      prisma.payment.findMany({
        where: { userId },
        select: { invoiceId: true, amount: true, paidAt: true },
      }),
      prisma.client.findMany({
        where: { userId, archivedAt: null, stage: { not: "LEAD" } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          billingMode: true,
        },
      }),
      prisma.task.findMany({
        where: { userId, completedAt: { not: null, gte: periodStart } },
        select: { clientId: true, estimate: true, actualDays: true },
      }),
      prisma.quote.findMany({
        where: { userId },
        select: { status: true, sentAt: true, decidedAt: true, total: true },
      }),
      prisma.$queryRaw<MonthBucketRow[]>`
          SELECT date_trunc('month', "paidAt") AS month, SUM(amount)::float AS total
          FROM payments
          WHERE "userId" = ${userId} AND "paidAt" >= ${periodStart}
          GROUP BY 1
          ORDER BY 1
        `,
      prisma.$queryRaw<MonthBucketRow[]>`
          SELECT date_trunc('month', "issueDate") AS month, SUM(total)::float AS total
          FROM invoices
          WHERE "userId" = ${userId}
            AND "status" <> 'CANCELLED'
            AND "issueDate" >= ${periodStart}
          GROUP BY 1
          ORDER BY 1
        `,
    ])

    const paidByMonthMap = new Map(
      paidByMonth.map((b) => [b.month.toISOString().slice(0, 7), b.total]),
    )
    const issuedByMonthMap = new Map(
      issuedByMonth.map((b) => [b.month.toISOString().slice(0, 7), b.total]),
    )
    const monthBuckets = []
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const key = start.toISOString().slice(0, 7)
      monthBuckets.push({
        label: start.toLocaleDateString("fr-FR", { month: "short" }),
        paid: paidByMonthMap.get(key) ?? 0,
        issued: issuedByMonthMap.get(key) ?? 0,
        isCurrent: i === 0,
      })
    }

    const totalRevenue = monthBuckets.reduce((s, m) => s + m.paid, 0)
    const avgRevenue = months > 0 ? Math.round(totalRevenue / months) : 0
    const lastMonth = monthBuckets.at(-1)?.paid ?? 0
    const prevMonth = monthBuckets.at(-2)?.paid ?? lastMonth
    const trend =
      prevMonth > 0
        ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100)
        : 0

    const paidByInvoice = new Map<string, { paid: number; lastPaidAt: Date }>()
    for (const p of payments) {
      const amount = decimalToNumber(p.amount) ?? 0
      const prev = paidByInvoice.get(p.invoiceId)
      paidByInvoice.set(
        p.invoiceId,
        prev
          ? {
              paid: prev.paid + amount,
              lastPaidAt:
                p.paidAt > prev.lastPaidAt ? p.paidAt : prev.lastPaidAt,
            }
          : { paid: amount, lastPaidAt: p.paidAt },
      )
    }
    const revByClient = new Map<string, number>()
    for (const inv of invoices) {
      const paid = paidByInvoice.get(inv.id)?.paid ?? 0
      if (paid > 0) {
        revByClient.set(
          inv.clientId,
          (revByClient.get(inv.clientId) ?? 0) + paid,
        )
      }
    }

    const daysByClient = aggregateDaysByClient(tasks)
    const concentration = buildConcentration(
      clients.map((c) => ({
        clientId: c.id,
        revenue: revByClient.get(c.id) ?? 0,
        days: daysByClient.get(c.id) ?? 0,
      })),
    )
    const shareByClient = new Map(
      concentration.rows.map((r) => [r.clientId, r] as const),
    )

    const byClient = clients
      .map((c) => ({
        clientId: c.id,
        name: truncateText(
          c.company ?? `${c.firstName} ${c.lastName}`.trim(),
          NAME_MAX_CHARS,
        ),
        revenue: revByClient.get(c.id) ?? 0,
      }))
      .filter((x) => x.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((x) => {
        const days = daysByClient.get(x.clientId) ?? 0
        const shares = shareByClient.get(x.clientId)
        return {
          ...x,
          days,
          effectiveRate: computeEffectiveRate(x.revenue, days),
          revenueShare: shares?.revenueShare ?? null,
          daysShare: shares?.daysShare ?? null,
        }
      })

    const billingModeRev = { DAILY: 0, FIXED: 0, HOURLY: 0 }
    for (const c of clients) {
      billingModeRev[c.billingMode] += revByClient.get(c.id) ?? 0
    }
    const byType = (
      [
        { type: "DAILY" as const, revenue: billingModeRev.DAILY },
        { type: "FIXED" as const, revenue: billingModeRev.FIXED },
        { type: "HOURLY" as const, revenue: billingModeRev.HOURLY },
      ] as const
    ).filter((x) => x.revenue > 0)

    const fullyPaidInvoices = invoices.filter(
      (inv) => inv.paymentStatus === "PAID" || inv.paymentStatus === "OVERPAID",
    )
    const delays = fullyPaidInvoices
      .map((inv) => {
        const entry = paidByInvoice.get(inv.id)
        if (!entry) return null
        return Math.round(
          (entry.lastPaidAt.getTime() - inv.issueDate.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      })
      .filter((x): x is number => x !== null && x >= 0)
    const avgDelay =
      delays.length > 0
        ? Math.round(delays.reduce((s, d) => s + d, 0) / delays.length)
        : 0

    const sentCount = invoices.filter(
      (inv) =>
        inv.status === "SENT" &&
        (inv.paymentStatus === "UNPAID" ||
          inv.paymentStatus === "PARTIALLY_PAID"),
    ).length
    const collectionRate =
      fullyPaidInvoices.length + sentCount > 0
        ? Math.round(
            (fullyPaidInvoices.length /
              (fullyPaidInvoices.length + sentCount)) *
              100,
          )
        : 0
    const avgInvoice =
      fullyPaidInvoices.length > 0
        ? Math.round(totalRevenue / fullyPaidInvoices.length)
        : 0

    const quoteKpis = computeQuoteKpis(
      quotes.map((q) => ({
        status: q.status,
        sentAt: q.sentAt?.toISOString() ?? null,
        decidedAt: q.decidedAt?.toISOString() ?? null,
        total: decimalToNumber(q.total) ?? 0,
      })),
    )

    return {
      range: args.range,
      months: monthBuckets,
      kpi: {
        totalRevenue,
        avgRevenue,
        trend,
        runRate: avgRevenue * 12,
        paidCount: fullyPaidInvoices.length,
        avgDelay,
        avgInvoice,
        collectionRate,
        winRate: quoteKpis.winRate,
        avgDecisionDays: quoteKpis.avgDecisionDays,
      },
      byClient,
      byType: [...byType],
      concentration: {
        totalRevenue: concentration.totalRevenue,
        totalDays: concentration.totalDays,
        topClientShare: concentration.topClientShare,
        topThreeShare: concentration.topThreeShare,
        level: concentration.level,
      },
    }
  })
}

/**
 * Register the dashboard and analytics read tools for one principal.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerInsightTools(server: McpServer, userId: string): void {
  server.registerTool(
    "get_dashboard",
    {
      description:
        "Get the billing dashboard snapshot: revenue KPIs, monthly buckets, " +
        "overdue invoices, pipeline value. Pipeline value and task counts " +
        "depend on tasks, which are a MANUALLY-PULLED MIRROR of Linear " +
        "issues — check the response's syncStale field; when true, the " +
        "data may be out of date and you should call trigger_linear_sync " +
        "(then poll get_linear_sync_status) before relying on these " +
        "results, instead of retrying this call.",
      inputSchema: getDashboardInput,
      outputSchema: getDashboardOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    () => getDashboard(userId),
  )
  server.registerTool(
    "get_analytics",
    {
      description:
        "Get period analytics (range 3m, 6m or 12m): monthly paid/issued revenue, KPIs, top-5 clients by revenue, revenue by billing mode, client concentration.",
      inputSchema: getAnalyticsInput,
      outputSchema: getAnalyticsOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => getAnalytics(userId, args),
  )
}
