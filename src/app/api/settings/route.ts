import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import {
  updateSettingsSchema,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_DASHBOARD_KPIS,
} from "@/lib/schemas/settings"
import { logAudit } from "@/lib/audit-log"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

import type { NotificationPrefs, DashboardKpiId } from "@/lib/schemas/settings"

function serializeSettings(settings: {
  availableHoursPerMonth: number
  monthlyRevenueTarget: unknown
  defaultCurrency: string
  defaultPaymentDays: number
  defaultRate: unknown
  notificationPrefs: unknown
  dashboardKpis: unknown
  theme: string
  accentColor: string
}) {
  return {
    availableHoursPerMonth: settings.availableHoursPerMonth,
    monthlyRevenueTarget: Number(settings.monthlyRevenueTarget),
    defaultCurrency: settings.defaultCurrency,
    defaultPaymentDays: settings.defaultPaymentDays,
    defaultRate: Number(settings.defaultRate),
    notificationPrefs:
      (settings.notificationPrefs as NotificationPrefs | null) ??
      DEFAULT_NOTIFICATION_PREFS,
    dashboardKpis:
      (settings.dashboardKpis as DashboardKpiId[] | null) ??
      DEFAULT_DASHBOARD_KPIS,
    theme: settings.theme,
    accentColor: settings.accentColor,
  }
}

/**
 * GET /api/settings
 * Retrieves all user settings (creates defaults if none exist).
 */
export async function GET(request: Request) {
  try {
    const rl = rateLimit(request)
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

    const settings = await prisma.userSettings.upsert({
      where: { userId: userOrError.id },
      create: { userId: userOrError.id },
      update: {},
    })

    return NextResponse.json(serializeSettings(settings))
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/settings
 * Updates user settings. Accepts any subset of fields.
 */
export async function PUT(request: Request) {
  try {
    const rl = rateLimit(request, { limit: 30, windowMs: 60_000 })
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

    const body: unknown = await request.json()
    const parsed = updateSettingsSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: userOrError.id },
      create: { userId: userOrError.id, ...updateData },
      update: updateData,
    })

    logAudit({
      userId: userOrError.id,
      action: "UPDATE",
      entity: "UserSettings",
    })

    return NextResponse.json(serializeSettings(settings))
  } catch (error) {
    return handleApiError(error)
  }
}
