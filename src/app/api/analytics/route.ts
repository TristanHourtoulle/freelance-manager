import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"

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

    const paidByInvoice = new Map<string, number>()
    for (const p of payments) {
      paidByInvoice.set(
        p.invoiceId,
        (paidByInvoice.get(p.invoiceId) ?? 0) +
          (decimalToNumber(p.amount) ?? 0),
      )
    }
    const revByClient = new Map<string, number>()
    for (const inv of invoices) {
      const paid = paidByInvoice.get(inv.id) ?? 0
      if (paid > 0)
        revByClient.set(
          inv.clientId,
          (revByClient.get(inv.clientId) ?? 0) + paid,
        )
    }
    const byClient = clients
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
    const weeks = []
    for (let i = weekCount - 1; i >= 0; i--) {
      const wStart = new Date(startOfWeek0.getTime() - i * weekMs)
      const wEnd = new Date(wStart.getTime() + weekMs)
      const done = tasks.filter(
        (t) => t.completedAt && t.completedAt >= wStart && t.completedAt < wEnd,
      ).length
      const invoiced = tasks.filter(
        (t) =>
          t.completedAt &&
          t.completedAt >= wStart &&
          t.completedAt < wEnd &&
          t.invoiceId,
      ).length
      const w = new Date(wStart)
      const oneJan = new Date(w.getFullYear(), 0, 1)
      const weekNum = Math.ceil(
        ((w.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7,
      )
      weeks.push({ label: `S${weekNum}`, done, invoiced })
    }

    const heatmap = []
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const row = []
      for (let i = weekCount - 1; i >= 0; i--) {
        const wStart = new Date(startOfWeek0.getTime() - i * weekMs)
        const dayStart = new Date(
          wStart.getTime() + dayIdx * 24 * 60 * 60 * 1000,
        )
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
        const count = tasks.filter(
          (t) =>
            t.completedAt &&
            t.completedAt >= dayStart &&
            t.completedAt < dayEnd,
        ).length
        row.push(count)
      }
      heatmap.push(row)
    }

    const fullyPaidInvoices = invoices.filter(
      (inv) => inv.paymentStatus === "PAID" || inv.paymentStatus === "OVERPAID",
    )
    const delays = fullyPaidInvoices
      .map((inv) => {
        const inv_payments = payments.filter((p) => p.invoiceId === inv.id)
        if (!inv_payments.length) return null
        const last = inv_payments.reduce(
          (max, p) => (p.paidAt > max ? p.paidAt : max),
          inv_payments[0]!.paidAt,
        )
        return Math.round(
          (last.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24),
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
    })
  } catch (error) {
    return apiServerError(error)
  }
}
