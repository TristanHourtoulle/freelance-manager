import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { getInvoiceComputed } from "@/lib/payments"

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const yearStart = new Date(today.getFullYear(), 0, 1)
    const chartStart = new Date(today.getFullYear(), today.getMonth() - 7, 1)

    const [
      openInvoices,
      paymentTotals,
      paymentBuckets,
      pendingTasks,
      recentInvoices,
      recentTasks,
      lastSync,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          userId: user.id,
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
      prisma.$queryRaw<
        {
          paid_count: bigint
          revenue_month: number
          revenue_year: number
        }[]
      >`
        SELECT
          COUNT(*)::bigint AS paid_count,
          COALESCE(SUM(amount) FILTER (WHERE "paidAt" >= ${monthStart}), 0)::float AS revenue_month,
          COALESCE(SUM(amount) FILTER (WHERE "paidAt" >= ${yearStart}), 0)::float AS revenue_year
        FROM payments
        WHERE "userId" = ${user.id}
      `,
      prisma.$queryRaw<{ month: Date; total: number }[]>`
        SELECT
          date_trunc('month', "paidAt") AS month,
          SUM(amount)::float AS total
        FROM payments
        WHERE "userId" = ${user.id} AND "paidAt" >= ${chartStart}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.task.findMany({
        where: {
          userId: user.id,
          status: "PENDING_INVOICE",
          client: { billingMode: { in: ["DAILY", "HOURLY"] } },
        },
        select: { clientId: true },
      }),
      prisma.invoice.findMany({
        where: { userId: user.id },
        orderBy: { issueDate: "desc" },
        take: 5,
        include: {
          client: {
            select: {
              firstName: true,
              lastName: true,
              company: true,
              color: true,
            },
          },
          payments: { select: { amount: true, paidAt: true } },
        },
      }),
      prisma.task.findMany({
        where: { userId: user.id, completedAt: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 6,
        include: { project: { select: { key: true } } },
      }),
      prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { linearLastSyncedAt: true },
      }),
    ])

    const totals = paymentTotals[0]
    const paidCount = totals ? Number(totals.paid_count) : 0
    const revenueMonth = totals?.revenue_month ?? 0
    const revenueYear = totals?.revenue_year ?? 0

    const overdueList = openInvoices
      .map((inv) => ({ inv, computed: getInvoiceComputed(inv) }))
      .filter((x) => x.computed.isOverdue)

    const outstanding = openInvoices.reduce(
      (s, inv) => s + getInvoiceComputed(inv).balanceDue,
      0,
    )
    const overdueAmount = overdueList.reduce(
      (s, x) => s + x.computed.balanceDue,
      0,
    )

    const pipelineClientCount = new Set(pendingTasks.map((t) => t.clientId))
      .size

    const bucketByMonth = new Map(
      paymentBuckets.map(
        (b) => [b.month.toISOString().slice(0, 7), b.total] as const,
      ),
    )
    const months: { month: string; total: number; isCurrent: boolean }[] = []
    for (let i = 7; i >= 0; i--) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const key = start.toISOString().slice(0, 7)
      months.push({
        month: start.toLocaleDateString("fr-FR", { month: "short" }),
        total: bucketByMonth.get(key) ?? 0,
        isCurrent: i === 0,
      })
    }

    return NextResponse.json({
      kpi: {
        revenueMonth,
        revenueYear,
        paidCount,
        outstanding,
        sentCount: openInvoices.length,
        overdueAmount,
        overdueCount: overdueList.length,
        pipelineCount: pendingTasks.length,
        pipelineClientCount,
      },
      months,
      overdue: overdueList.map(({ inv, computed }) => ({
        id: inv.id,
        number: inv.number,
        clientId: inv.clientId,
        total: computed.balanceDue,
        dueDate: inv.dueDate.toISOString(),
      })),
      recentInvoices: recentInvoices.map((inv) => {
        const c = getInvoiceComputed(inv)
        return {
          id: inv.id,
          number: inv.number,
          kind: inv.kind,
          status: inv.status,
          paymentStatus: inv.paymentStatus,
          isOverdue: c.isOverdue,
          issueDate: inv.issueDate.toISOString(),
          total: decimalToNumber(inv.total) ?? 0,
          balanceDue: c.balanceDue,
          client: inv.client,
        }
      }),
      recentTasks: recentTasks.map((t) => ({
        id: t.id,
        linearIdentifier: t.linearIdentifier,
        title: t.title,
        status: t.status,
        projectKey: t.project?.key ?? null,
      })),
      lastSync: lastSync?.linearLastSyncedAt?.toISOString() ?? null,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
