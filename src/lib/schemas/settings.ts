import { z } from "zod/v4"

export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD"] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

export const THEME_OPTIONS = ["light", "dark", "system"] as const
export type ThemeOption = (typeof THEME_OPTIONS)[number]

/** Notification preferences stored as JSON in UserSettings. */
export const notificationPrefsSchema = z.object({
  billingReminder: z.object({
    enabled: z.boolean(),
    delayDays: z.number().int().min(1).max(90),
  }),
  inactiveClient: z.object({
    enabled: z.boolean(),
    delayDays: z.number().int().min(7).max(365),
  }),
  syncAlert: z.object({ enabled: z.boolean() }),
  paymentOverdue: z.object({ enabled: z.boolean() }),
})

export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>

/** All available dashboard KPI identifiers. */
export const DASHBOARD_KPI_IDS = [
  "monthlyRevenue",
  "pipeline",
  "billedHours",
  "activeClients",
  "overdueInvoices",
  "monthlyExpenses",
] as const

export type DashboardKpiId = (typeof DASHBOARD_KPI_IDS)[number]

/** Default KPIs shown on the dashboard when no preference is set. */
export const DEFAULT_DASHBOARD_KPIS: DashboardKpiId[] = [
  "monthlyRevenue",
  "pipeline",
  "billedHours",
]

export const dashboardKpisSchema = z.array(z.enum(DASHBOARD_KPI_IDS))

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  billingReminder: { enabled: true, delayDays: 7 },
  inactiveClient: { enabled: true, delayDays: 30 },
  syncAlert: { enabled: true },
  paymentOverdue: { enabled: true },
}

/** Validates the request body when updating user settings. */
export const updateSettingsSchema = z.object({
  availableHoursPerMonth: z.number().int().min(1).max(744).optional(),
  monthlyRevenueTarget: z.number().min(0).max(9999999.99).optional(),
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES).optional(),
  defaultPaymentDays: z.number().int().min(1).max(365).optional(),
  defaultRate: z.number().min(0).max(9999999.99).optional(),
  notificationPrefs: notificationPrefsSchema.optional(),
  theme: z.enum(THEME_OPTIONS).optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color")
    .optional(),
  dashboardKpis: dashboardKpisSchema.optional(),
})

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>

/** Validates a standalone available-hours-per-month update. */
export const availableHoursSchema = z.object({
  availableHoursPerMonth: z.number().int().min(1).max(744),
})

export type AvailableHoursInput = z.infer<typeof availableHoursSchema>

/** Validates a standalone monthly revenue target update. */
export const revenueTargetSchema = z.object({
  monthlyRevenueTarget: z.number().min(0).max(9999999.99),
})

export type RevenueTargetInput = z.infer<typeof revenueTargetSchema>
