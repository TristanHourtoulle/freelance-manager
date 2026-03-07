import { z } from "zod/v4"

export const notificationTypeSchema = z.enum([
  "BILLING_REMINDER",
  "INACTIVE_CLIENT",
  "SYNC_ALERT",
  "IMPORT_SUMMARY",
])

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === "boolean") return val
    return val === "true" || val === "1"
  })

export const notificationFilterSchema = z.object({
  unreadOnly: booleanFromString.default(true),
  type: notificationTypeSchema.optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
})

export type NotificationFilter = z.infer<typeof notificationFilterSchema>
