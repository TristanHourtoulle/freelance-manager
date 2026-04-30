import { z } from "zod/v4"
import { invoiceCreateSchema } from "./invoice"

export const invoiceSplitScheduleSchema = z.enum(["MONTHLY", "WEEKLY", "ONCE"])

/**
 * Split a single invoice payload into N installments.
 *
 * @param parts integer count of installments (must be >= 2)
 * @param schedule cadence to spread the dueDate of each part. ONCE keeps the
 *   same dueDate for all parts (rare but useful for accounting tricks).
 */
export const invoiceSplitSchema = z.object({
  parts: z.coerce.number().int().min(2).max(36),
  schedule: invoiceSplitScheduleSchema.default("MONTHLY"),
  base: invoiceCreateSchema,
})

export type InvoiceSplitInput = z.input<typeof invoiceSplitSchema>
