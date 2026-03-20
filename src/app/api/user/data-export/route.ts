import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit-log"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

/**
 * GET /api/user/data-export
 * Exports all user data as JSON for GDPR compliance (right of access).
 * Returns a downloadable JSON file containing every record linked to the user.
 *
 * @returns 200 - JSON file download with all user data
 * @throws 401 - Unauthenticated request
 */
export async function GET(request: Request) {
  try {
    const rl = rateLimit(request, { limit: 5, windowMs: 60_000 })
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

    const userId = userOrError.id

    const [
      user,
      settings,
      clients,
      expenses,
      invoices,
      notifications,
      bankTransactions,
      tags,
      auditLogs,
      usageMetrics,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.userSettings.findUnique({
        where: { userId },
        select: {
          id: true,
          userId: true,
          availableHoursPerMonth: true,
          monthlyRevenueTarget: true,
          defaultCurrency: true,
          defaultPaymentDays: true,
          defaultRate: true,
          notificationPrefs: true,
          dashboardKpis: true,
          taxRegime: true,
          tvaRate: true,
          activityType: true,
          acreEligible: true,
          theme: true,
          accentColor: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.client.findMany({
        where: { userId },
        include: {
          linearMappings: true,
          taskOverrides: true,
        },
      }),
      prisma.expense.findMany({
        where: { userId },
        include: { tags: { select: { id: true, name: true, color: true } } },
      }),
      prisma.invoice.findMany({
        where: { client: { userId } },
        include: {
          files: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              uploadedAt: true,
            },
          },
        },
      }),
      prisma.notification.findMany({ where: { userId } }),
      prisma.bankTransaction.findMany({ where: { userId } }),
      prisma.tag.findMany({ where: { userId } }),
      prisma.auditLog.findMany({ where: { userId } }),
      prisma.usageMetric.findMany({ where: { userId } }),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      settings,
      clients: clients.map((c) => ({
        ...c,
        rate: Number(c.rate),
        taskOverrides: c.taskOverrides.map((o) => ({
          ...o,
          rateOverride: o.rateOverride ? Number(o.rateOverride) : null,
        })),
      })),
      expenses: expenses.map((e) => ({
        ...e,
        amount: Number(e.amount),
      })),
      invoices: invoices.map((i) => ({
        ...i,
        totalAmount: Number(i.totalAmount),
      })),
      notifications,
      bankTransactions: bankTransactions.map((t) => ({
        ...t,
        amount: Number(t.amount),
      })),
      tags,
      auditLogs,
      usageMetrics,
    }

    logAudit({
      userId,
      action: AUDIT_ACTIONS.EXPORT,
      entity: "UserData",
    })

    const dateLabel = new Date().toISOString().split("T")[0]

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="data-export-${dateLabel}.json"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
