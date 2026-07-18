import { NextResponse } from "next/server"
import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"
import { computeDashboardKpis } from "@/domain/billing/kpis"

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const yearStart = new Date(today.getFullYear(), 0, 1)
    const chartStart = new Date(today.getFullYear(), today.getMonth() - 7, 1)

    const pendingTasksWhere: Prisma.TaskWhereInput = {
      userId: user.id,
      status: "PENDING_INVOICE",
      client: { billingMode: { in: ["DAILY", "HOURLY"] } },
    }

    const [
      openInvoices,
      paymentTotals,
      paymentBuckets,
      pipelineTasks,
      pipelineClients,
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
          paid_count_month: bigint
          revenue_month: number
          revenue_year: number
        }[]
      >`
        SELECT
          COUNT(*)::bigint AS paid_count,
          COUNT(*) FILTER (WHERE "paidAt" >= ${monthStart})::bigint AS paid_count_month,
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
        where: pendingTasksWhere,
        select: {
          estimate: true,
          client: { select: { billingMode: true, rate: true } },
        },
      }),
      prisma.task.groupBy({ by: ["clientId"], where: pendingTasksWhere }),
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
        select: {
          id: true,
          linearIdentifier: true,
          title: true,
          status: true,
          project: { select: { key: true } },
        },
      }),
      prisma.userSettings.findUnique({
        where: { userId: user.id },
        select: { linearLastSyncedAt: true },
      }),
    ])

    const {
      kpi,
      months,
      overdue,
      recentInvoices: recentInvoicesOut,
    } = computeDashboardKpis({
      now: today,
      openInvoices,
      paymentTotals,
      paymentBuckets,
      pipelineTasks: pipelineTasks.map((task) => ({
        estimate: task.estimate,
        billingMode: task.client.billingMode,
        rate: task.client.rate,
      })),
      pipelineClients,
      recentInvoices,
    })

    return NextResponse.json({
      kpi,
      months,
      overdue,
      recentInvoices: recentInvoicesOut,
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
