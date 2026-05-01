import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { pipelineValueForTask } from "@/lib/billing-math"
import { getInvoiceComputed } from "@/lib/payments"

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const yearStart = new Date(today.getFullYear(), 0, 1)

    const [
      openInvoices,
      payments,
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
      prisma.payment.findMany({
        where: { userId: user.id },
        select: { amount: true, paidAt: true },
      }),
      prisma.task.findMany({
        where: { userId: user.id, status: "PENDING_INVOICE" },
        include: {
          client: {
            select: { billingMode: true, rate: true },
          },
        },
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

    const revenueMonth = payments
      .filter((p) => p.paidAt >= monthStart)
      .reduce((s, p) => s + (decimalToNumber(p.amount) ?? 0), 0)
    const revenueYear = payments
      .filter((p) => p.paidAt >= yearStart)
      .reduce((s, p) => s + (decimalToNumber(p.amount) ?? 0), 0)

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

    const pipelineValue = pendingTasks.reduce(
      (s, t) =>
        s +
        pipelineValueForTask({
          billingMode: t.client.billingMode,
          rate: decimalToNumber(t.client.rate) ?? 0,
          estimateDays: decimalToNumber(t.estimate),
        }),
      0,
    )

    const months: { month: string; total: number; isCurrent: boolean }[] = []
    for (let i = 7; i >= 0; i--) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1)
      const total = payments
        .filter((p) => p.paidAt >= start && p.paidAt < end)
        .reduce((s, p) => s + (decimalToNumber(p.amount) ?? 0), 0)
      months.push({
        month: start.toLocaleDateString("fr-FR", { month: "short" }),
        total,
        isCurrent: i === 0,
      })
    }

    return NextResponse.json({
      kpi: {
        revenueMonth,
        revenueYear,
        paidCount: payments.length,
        outstanding,
        sentCount: openInvoices.length,
        overdueAmount,
        overdueCount: overdueList.length,
        pipelineValue,
        pipelineCount: pendingTasks.length,
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
