import { prisma } from "@/lib/db"
import { getLinearSyncStatus } from "@/lib/linear-service"

import type { NotificationType, Prisma } from "@/generated/prisma/client"

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const TWO_HOURS_MS = 2 * 60 * 60 * 1000

interface NotificationInput {
  userId: string
  type: NotificationType
  title: string
  message: string
  metadata?: Prisma.InputJsonValue
}

async function hasRecentNotification(
  userId: string,
  type: NotificationType,
  sinceMs: number,
  metadataKey?: { key: string; value: string },
): Promise<boolean> {
  const since = new Date(Date.now() - sinceMs)

  const where: Record<string, unknown> = {
    userId,
    type,
    createdAt: { gte: since },
  }

  if (metadataKey) {
    where.metadata = {
      path: [metadataKey.key],
      equals: metadataKey.value,
    }
  }

  const existing = await prisma.notification.findFirst({ where })
  return existing !== null
}

async function createNotification(input: NotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? undefined,
    },
  })
}

/**
 * Creates billing reminder notifications for clients with tasks pending invoice for 7+ days.
 * Skips clients that already received a reminder in the last 24 hours.
 *
 * @param userId - The authenticated user ID
 */
export async function computeBillingReminders(userId: string): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS)

  const pendingByClient = await prisma.taskOverride.groupBy({
    by: ["clientId"],
    where: {
      client: { userId, archivedAt: null },
      toInvoice: true,
      invoiced: false,
      createdAt: { lte: sevenDaysAgo },
    },
    _count: { id: true },
  })

  for (const group of pendingByClient) {
    const alreadyNotified = await hasRecentNotification(
      userId,
      "BILLING_REMINDER",
      24 * 60 * 60 * 1000,
      { key: "clientId", value: group.clientId },
    )
    if (alreadyNotified) continue

    const client = await prisma.client.findFirst({
      where: { id: group.clientId, userId },
      select: { name: true, rate: true },
    })
    if (!client) continue

    const taskCount = group._count.id
    const totalAmount = Number(client.rate) * taskCount

    await createNotification({
      userId,
      type: "BILLING_REMINDER",
      title: "Tasks pending invoice",
      message: `${taskCount} task${taskCount > 1 ? "s" : ""} pending invoice for 7+ days for ${client.name} (total: ${totalAmount.toFixed(2)}€)`,
      metadata: {
        clientId: group.clientId,
        clientName: client.name,
        taskCount,
        totalAmount,
      },
    })
  }
}

/**
 * Creates notifications for active clients with no activity for 30+ days.
 * Skips clients that already received an alert in the last 7 days.
 *
 * @param userId - The authenticated user ID
 */
export async function computeInactiveClientAlerts(
  userId: string,
): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS)

  const activeClients = await prisma.client.findMany({
    where: { userId, archivedAt: null },
    select: {
      id: true,
      name: true,
      createdAt: true,
      taskOverrides: {
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  })

  for (const client of activeClients) {
    const lastActivity = client.taskOverrides[0]?.updatedAt ?? client.createdAt

    if (lastActivity > thirtyDaysAgo) continue

    const alreadyNotified = await hasRecentNotification(
      userId,
      "INACTIVE_CLIENT",
      SEVEN_DAYS_MS,
      { key: "clientId", value: client.id },
    )
    if (alreadyNotified) continue

    const daysSince = Math.floor(
      (Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000),
    )

    await createNotification({
      userId,
      type: "INACTIVE_CLIENT",
      title: "Inactive client",
      message: `${client.name} has no activity for ${daysSince} days`,
      metadata: {
        clientId: client.id,
        clientName: client.name,
        daysSinceActivity: daysSince,
      },
    })
  }
}

/**
 * Creates a notification when Linear data is stale.
 * Skips if an alert was already sent in the last 2 hours.
 *
 * @param userId - The authenticated user ID
 */
export async function computeSyncAlerts(userId: string): Promise<void> {
  const { isStale, lastSyncedAt } = getLinearSyncStatus()

  if (!isStale) return

  const alreadyNotified = await hasRecentNotification(
    userId,
    "SYNC_ALERT",
    TWO_HOURS_MS,
  )
  if (alreadyNotified) return

  const label =
    lastSyncedAt === null
      ? "never synced"
      : `last sync: ${Math.floor((Date.now() - lastSyncedAt) / 60_000)} min ago`

  await createNotification({
    userId,
    type: "SYNC_ALERT",
    title: "Linear sync stale",
    message: `Linear data is stale (${label})`,
    metadata: { lastSyncedAt },
  })
}

/**
 * Creates notifications for invoices past their 30-day payment deadline.
 * Skips invoices that already received an alert in the last 24 hours.
 *
 * @param userId - The authenticated user ID
 */
export async function computePaymentOverdueAlerts(
  userId: string,
): Promise<void> {
  const now = new Date()

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: "SENT",
      paymentDueDate: { lt: now, not: null },
      client: { userId, archivedAt: null },
    },
    include: {
      client: { select: { id: true, name: true } },
    },
  })

  for (const invoice of overdueInvoices) {
    const alreadyNotified = await hasRecentNotification(
      userId,
      "PAYMENT_OVERDUE",
      24 * 60 * 60 * 1000,
      { key: "invoiceId", value: invoice.id },
    )
    if (alreadyNotified) continue

    const daysOverdue = Math.floor(
      (now.getTime() - invoice.paymentDueDate!.getTime()) /
        (24 * 60 * 60 * 1000),
    )

    const monthLabel = invoice.month.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })

    await createNotification({
      userId,
      type: "PAYMENT_OVERDUE",
      title: "Payment overdue",
      message: `Invoice for ${invoice.client.name} (${monthLabel}) is overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} (${Number(invoice.totalAmount).toFixed(2)}EUR)`,
      metadata: {
        invoiceId: invoice.id,
        clientId: invoice.client.id,
        clientName: invoice.client.name,
        daysOverdue,
        totalAmount: Number(invoice.totalAmount),
      },
    })
  }
}

/**
 * Creates a notification when monthly revenue is below the user's target.
 * Only checks after the 15th of the month. Alerts if revenue is below 70%
 * of expected linear progress. Cooldown: 7 days.
 *
 * @param userId - The authenticated user ID
 */
export async function computeRevenueTargetAlert(userId: string): Promise<void> {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { monthlyRevenueTarget: true },
  })

  if (!settings || Number(settings.monthlyRevenueTarget) <= 0) return

  const target = Number(settings.monthlyRevenueTarget)
  const now = new Date()
  const dayOfMonth = now.getDate()

  // Only alert after the 15th of the month (mid-month check)
  if (dayOfMonth < 15) return

  // Calculate current month revenue from invoiced task overrides
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const invoicedOverrides = await prisma.taskOverride.findMany({
    where: {
      invoiced: true,
      invoicedAt: { gte: firstOfMonth, lt: firstOfNextMonth },
      client: { userId, archivedAt: null },
    },
    include: {
      client: { select: { rate: true } },
    },
  })

  let monthlyRevenue = 0
  for (const override of invoicedOverrides) {
    const rate = Number(override.rateOverride ?? override.client.rate)
    monthlyRevenue += rate
  }

  // Calculate expected progress (linear projection)
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate()
  const expectedProgress = (dayOfMonth / daysInMonth) * target

  // Alert if below 70% of expected progress
  if (monthlyRevenue >= expectedProgress * 0.7) return

  const alreadyNotified = await hasRecentNotification(
    userId,
    "BILLING_REMINDER",
    SEVEN_DAYS_MS,
    { key: "alertType", value: "revenue_target" },
  )
  if (alreadyNotified) return

  const percentage = Math.round((monthlyRevenue / target) * 100)

  await createNotification({
    userId,
    type: "BILLING_REMINDER",
    title: "Revenue below target",
    message: `Monthly revenue is at ${percentage}% of target (${monthlyRevenue.toFixed(2)}EUR / ${target.toFixed(2)}EUR). Consider reviewing pending invoices.`,
    metadata: {
      alertType: "revenue_target",
      currentRevenue: monthlyRevenue,
      target,
      percentage,
    },
  })
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000

/**
 * Creates notifications for active (non-free) clients that have not been
 * invoiced in the last 60 days. Cooldown: 14 days per client.
 *
 * @param userId - The authenticated user ID
 */
export async function computeUnbilledClientAlerts(
  userId: string,
): Promise<void> {
  const sixtyDaysAgo = new Date(Date.now() - SIXTY_DAYS_MS)

  const activeClients = await prisma.client.findMany({
    where: {
      userId,
      archivedAt: null,
      billingMode: { not: "FREE" },
    },
    select: {
      id: true,
      name: true,
      taskOverrides: {
        where: { invoiced: true },
        orderBy: { invoicedAt: "desc" },
        take: 1,
        select: { invoicedAt: true },
      },
    },
  })

  for (const client of activeClients) {
    const lastInvoiced = client.taskOverrides[0]?.invoicedAt

    // Skip if recently invoiced
    if (lastInvoiced && lastInvoiced > sixtyDaysAgo) continue

    const alreadyNotified = await hasRecentNotification(
      userId,
      "BILLING_REMINDER",
      FOURTEEN_DAYS_MS,
      { key: "clientId", value: client.id },
    )
    if (alreadyNotified) continue

    const daysSince = lastInvoiced
      ? Math.floor(
          (Date.now() - lastInvoiced.getTime()) / (24 * 60 * 60 * 1000),
        )
      : null

    await createNotification({
      userId,
      type: "BILLING_REMINDER",
      title: "Client not billed recently",
      message: daysSince
        ? `${client.name} hasn't been billed in ${daysSince} days`
        : `${client.name} has never been billed`,
      metadata: {
        alertType: "unbilled_client",
        clientId: client.id,
        clientName: client.name,
        daysSinceLastInvoice: daysSince,
      },
    })
  }
}

/**
 * Runs all notification computations in parallel.
 *
 * @param userId - The authenticated user ID
 */
export async function computeAllNotifications(userId: string): Promise<void> {
  await Promise.all([
    computeBillingReminders(userId),
    computeInactiveClientAlerts(userId),
    computeSyncAlerts(userId),
    computePaymentOverdueAlerts(userId),
    computeRevenueTargetAlert(userId),
    computeUnbilledClientAlerts(userId),
  ])
}
