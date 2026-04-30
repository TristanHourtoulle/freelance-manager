import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { pipelineValueForTask } from "@/lib/billing-math"

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const yearStart = new Date(today.getFullYear(), 0, 1)
    const eightMonthsAgo = new Date(
      today.getFullYear(),
      today.getMonth() - 7,
      1,
    )

    const [
      paid,
      sent,
      overdue,
      pendingTasks,
      recentInvoices,
      recentTasks,
      lastSync,
    ] = await Promise.all([
      prisma.invoice.findMany({
        where: { userId: user.id, status: "PAID" },
        select: { paidAt: true, total: true },
      }),
      prisma.invoice.findMany({
        where: { userId: user.id, status: "SENT" },
        select: { id: true, total: true },
      }),
      prisma.invoice.findMany({
        where: { userId: user.id, status: "OVERDUE" },
        select: {
          id: true,
          total: true,
          dueDate: true,
          number: true,
          clientId: true,
        },
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

    const revenueMonth = paid
      .filter((i) => i.paidAt && i.paidAt >= monthStart)
      .reduce((s, i) => s + (decimalToNumber(i.total) ?? 0), 0)
    const revenueYear = paid
      .filter((i) => i.paidAt && i.paidAt >= yearStart)
      .reduce((s, i) => s + (decimalToNumber(i.total) ?? 0), 0)
    const outstanding =
      sent.reduce((s, i) => s + (decimalToNumber(i.total) ?? 0), 0) +
      overdue.reduce((s, i) => s + (decimalToNumber(i.total) ?? 0), 0)
    const overdueAmount = overdue.reduce(
      (s, i) => s + (decimalToNumber(i.total) ?? 0),
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
      const total = paid
        .filter((p) => p.paidAt && p.paidAt >= start && p.paidAt < end)
        .reduce((s, p) => s + (decimalToNumber(p.total) ?? 0), 0)
      months.push({
        month: start.toLocaleDateString("fr-FR", { month: "short" }),
        total,
        isCurrent: i === 0,
      })
    }
    void eightMonthsAgo

    return NextResponse.json({
      kpi: {
        revenueMonth,
        revenueYear,
        paidCount: paid.length,
        outstanding,
        sentCount: sent.length + overdue.length,
        overdueAmount,
        overdueCount: overdue.length,
        pipelineValue,
        pipelineCount: pendingTasks.length,
      },
      months,
      overdue: overdue.map((o) => ({
        id: o.id,
        number: o.number,
        clientId: o.clientId,
        total: decimalToNumber(o.total) ?? 0,
        dueDate: o.dueDate.toISOString(),
      })),
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        kind: inv.kind,
        status: inv.status,
        issueDate: inv.issueDate.toISOString(),
        total: decimalToNumber(inv.total) ?? 0,
        client: inv.client,
      })),
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
