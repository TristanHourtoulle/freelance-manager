import { z } from "zod/v4"

export const settingsUpdateSchema = z.object({
  defaultCurrency: z.string().length(3).optional(),
  defaultPaymentDays: z.coerce.number().int().min(0).max(180).optional(),
  defaultRate: z.coerce.number().min(0).max(100_000).optional(),
})

export const linearTokenSchema = z.object({
  token: z.string().min(10).max(200),
})

export type SettingsUpdateInput = z.input<typeof settingsUpdateSchema>
export type LinearTokenInput = z.input<typeof linearTokenSchema>
