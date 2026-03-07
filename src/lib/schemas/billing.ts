import { z } from "zod/v4"

import { CategorySchema } from "./client"

export const billingFilterSchema = z.object({
  clientId: z.string().optional(),
  category: CategorySchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export const markInvoicedSchema = z.object({
  linearIssueIds: z.array(z.string().min(1)).min(1),
})

export const historyFilterSchema = z.object({
  clientId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export type BillingFilter = z.infer<typeof billingFilterSchema>
export type MarkInvoicedInput = z.infer<typeof markInvoicedSchema>
export type HistoryFilter = z.infer<typeof historyFilterSchema>
