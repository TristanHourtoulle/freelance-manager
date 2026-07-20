import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import {
  aggregateDaysByClient,
  computeEffectiveRate,
} from "@/domain/analytics/effective-rate"
import { buildConcentration } from "@/domain/analytics/concentration"
import {
  accuracyByKey,
  computeEstimateAccuracy,
  type AccuracyResult,
} from "@/domain/analytics/estimate-accuracy"
import {
  buildCategoryMix,
  type ClientCategoryKey,
} from "@/domain/analytics/category-mix"

type BillingModeKey = "DAILY" | "FIXED" | "HOURLY"

const EMPTY_ACCURACY: AccuracyResult = {
  ratio: null,
  n: 0,
  coverage: null,
  sumEstimate: 0,
  sumActual: 0,
  reliable: false,
}

const RANGE_MONTHS: Record<string, number> = { "3m": 3, "6m": 6, "12m": 12 }

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const { searchParams } = new URL(req.url)
    const rangeKey = searchParams.get("range") ?? "12m"
    const months = RANGE_MONTHS[rangeKey] ?? 12

    const today = new Date()
    const periodStart = new Date(
      today.getFullYear(),
      today.getMonth() - (months - 1),
      1,
    )

    const [invoices, payments, clients, tasks, paidByMonth, issuedByMonth] =
      await Promise.all([
        prisma.invoice.findMany({
          where: { userId: user.id, status: { not: "CANCELLED" } },
          select: {
            id: true,
            clientId: true,
            status: true,
            paymentStatus: true,
            issueDate: true,
            total: true,
          },
        }),
        prisma.payment.findMany({
          where: { userId: user.id },
          select: { invoiceId: true, amount: true, paidAt: true },
        }),
        prisma.client.findMany({
          where: { userId: user.id, archivedAt: null },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            color: true,
            billingMode: true,
            category: true,
          },
        }),
        prisma.task.findMany({
          where: {
            userId: user.id,
            completedAt: { not: null, gte: periodStart },
          },
          select: {
            id: true,
            completedAt: true,
            status: true,
            invoiceId: true,
            clientId: true,
            estimate: true,
            actualDays: true,
          },
        }),
        prisma.$queryRaw<{ month: Date; total: number }[]>`
        SELECT date_trunc('month', "paidAt") AS month, SUM(amount)::float AS total
        FROM payments
        WHERE "userId" = ${user.id} AND "paidAt" >= ${periodStart}
        GROUP BY 1
        ORDER BY 1
      `,
        prisma.$queryRaw<{ month: Date; total: number }[]>`
        SELECT date_trunc('month', "issueDate") AS month, SUM(total)::float AS total
        FROM invoices
        WHERE "userId" = ${user.id}
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
    const monthBuckets: {
      label: string
      paid: number
      issued: number
      isCurrent: boolean
    }[] = []
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
      if (paid > 0)
        revByClient.set(
          inv.clientId,
          (revByClient.get(inv.clientId) ?? 0) + paid,
        )
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

    const topClients = clients
      .map((c) => ({
        client: {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          company: c.company,
          color: c.color,
        },
        revenue: revByClient.get(c.id) ?? 0,
      }))
      .filter((x) => x.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    const byClient = topClients.map((x) => {
      const days = daysByClient.get(x.client.id) ?? 0
      const shares = shareByClient.get(x.client.id)
      return {
        ...x,
        days,
        effectiveRate: computeEffectiveRate(x.revenue, days),
        revenueShare: shares?.revenueShare ?? null,
        daysShare: shares?.daysShare ?? null,
      }
    })

    const billingModeByClient = new Map(
      clients.map((c) => [c.id, c.billingMode as BillingModeKey] as const),
    )
    const modeKeyedTasks = tasks.flatMap((t) => {
      const key = billingModeByClient.get(t.clientId)
      return key ? [{ ...t, key }] : []
    })
    const accuracyByMode = accuracyByKey(modeKeyedTasks)
    const accuracyPerClient = accuracyByKey(
      tasks.map((t) => ({ ...t, key: t.clientId })),
    )
    const topClientIds = new Set(byClient.map((x) => x.client.id))
    const estimateAccuracy = {
      overall: computeEstimateAccuracy(tasks),
      byBillingMode: {
        DAILY: accuracyByMode.DAILY ?? EMPTY_ACCURACY,
        FIXED: accuracyByMode.FIXED ?? EMPTY_ACCURACY,
        HOURLY: accuracyByMode.HOURLY ?? EMPTY_ACCURACY,
      },
      byClient: Object.fromEntries(
        Object.entries(accuracyPerClient).filter(([id]) =>
          topClientIds.has(id),
        ),
      ),
    }

    const categoryMix = buildCategoryMix(
      clients.map((c) => ({
        id: c.id,
        category: c.category as ClientCategoryKey,
      })),
      tasks,
      revByClient,
    )

    const billingModeRev = { DAILY: 0, FIXED: 0, HOURLY: 0 }
    for (const c of clients) {
      const r = revByClient.get(c.id) ?? 0
      billingModeRev[c.billingMode as keyof typeof billingModeRev] += r
    }
    const byType = (
      [
        { type: "DAILY", revenue: billingModeRev.DAILY },
        { type: "FIXED", revenue: billingModeRev.FIXED },
        { type: "HOURLY", revenue: billingModeRev.HOURLY },
      ] as const
    ).filter((x) => x.revenue > 0)

    const weekCount = 12
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const startOfWeek0 = new Date(today)
    startOfWeek0.setHours(0, 0, 0, 0)
    startOfWeek0.setDate(
      startOfWeek0.getDate() - ((startOfWeek0.getDay() + 6) % 7),
    )
    const dayMs = 24 * 60 * 60 * 1000
    const weekStartMs = startOfWeek0.getTime()
    const weekCounts = Array.from({ length: weekCount }, () => ({
      done: 0,
      invoiced: 0,
    }))
    const heatmap = Array.from({ length: 7 }, () =>
      new Array<number>(weekCount).fill(0),
    )
    for (const t of tasks) {
      if (!t.completedAt) continue
      const offsetMs = t.completedAt.getTime() - weekStartMs
      const dayOffset = Math.floor(offsetMs / dayMs)
      const weekBack = Math.floor(dayOffset / 7)
      const col = weekCount - 1 + weekBack
      if (col < 0 || col >= weekCount) continue
      const bucket = weekCounts[col]!
      bucket.done += 1
      if (t.invoiceId) bucket.invoiced += 1
      const dayIdx = dayOffset - 7 * weekBack
      heatmap[dayIdx]![col]! += 1
    }

    const weeks = []
    for (let i = weekCount - 1; i >= 0; i--) {
      const col = weekCount - 1 - i
      const wStart = new Date(weekStartMs - i * weekMs)
      const oneJan = new Date(wStart.getFullYear(), 0, 1)
      const weekNum = Math.ceil(
        ((wStart.getTime() - oneJan.getTime()) / 86400000 +
          oneJan.getDay() +
          1) /
          7,
      )
      const bucket = weekCounts[col]!
      weeks.push({
        label: `S${weekNum}`,
        done: bucket.done,
        invoiced: bucket.invoiced,
      })
    }

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
    const conversion =
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

    return NextResponse.json({
      range: rangeKey,
      months: monthBuckets,
      kpi: {
        totalRevenue,
        avgRevenue,
        trend,
        paidCount: fullyPaidInvoices.length,
        avgDelay,
        avgInvoice,
        conversion,
        runRate: avgRevenue * 12,
      },
      byClient,
      byType,
      weeks,
      heatmap,
      concentration: {
        totalRevenue: concentration.totalRevenue,
        totalDays: concentration.totalDays,
        topClientShare: concentration.topClientShare,
        topThreeShare: concentration.topThreeShare,
        level: concentration.level,
      },
      estimateAccuracy,
      categoryMix,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
