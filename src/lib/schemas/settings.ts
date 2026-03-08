import { z } from "zod/v4"

/** Validates the request body when updating user settings (at least one field required). */
export const updateSettingsSchema = z
  .object({
    availableHoursPerMonth: z.number().int().min(1).max(744).optional(),
    monthlyRevenueTarget: z.number().min(0).max(9999999.99).optional(),
  })
  .refine(
    (data) =>
      data.availableHoursPerMonth !== undefined ||
      data.monthlyRevenueTarget !== undefined,
    { message: "At least one setting must be provided" },
  )

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
