import { z } from "zod/v4"

export const updateSettingsSchema = z.object({
  availableHoursPerMonth: z.number().int().min(1).max(744),
})

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
