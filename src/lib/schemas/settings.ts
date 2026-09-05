import { z } from "zod/v4"

/**
 * Fallback late-fee policy applied whenever `UserSettings` carries no
 * explicit `lateFeeFixedAmount` / `lateFeeAnnualRate` (mirrors the Prisma
 * column defaults). Shared by the settings route, the claim/waive route,
 * and their MCP twins so the fallback numbers never drift apart.
 */
export const DEFAULT_LATE_FEE_FIXED_AMOUNT = 40
export const DEFAULT_LATE_FEE_ANNUAL_RATE = 0.1

export const settingsUpdateSchema = z.object({
  defaultCurrency: z.string().length(3).optional(),
  defaultPaymentDays: z.coerce.number().int().min(0).max(180).optional(),
  defaultRate: z.coerce.number().min(0).max(100_000).optional(),
  workingDaysPerWeek: z.coerce.number().int().min(1).max(7).optional(),
  lateFeeFixedAmount: z.coerce.number().min(0).max(10_000).optional(),
  lateFeeAnnualRate: z.coerce.number().min(0).max(1).optional(),
})

export const linearTokenSchema = z.object({
  token: z.string().min(10).max(200),
})

export type SettingsUpdateInput = z.input<typeof settingsUpdateSchema>
export type LinearTokenInput = z.input<typeof linearTokenSchema>
