import { z } from "zod/v4"

export const BillingMode = z.enum(["HOURLY", "DAILY", "FIXED", "FREE"])
export const Category = z.enum([
  "FREELANCE",
  "STUDY",
  "PERSONAL",
  "SIDE_PROJECT",
])

export const createClientSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.email().optional(),
  company: z.string().max(100).trim().optional(),
  billingMode: BillingMode.default("HOURLY"),
  rate: z.number().min(0).default(0),
  category: Category.default("FREELANCE"),
  notes: z.string().max(2000).trim().optional(),
})

export const updateClientSchema = createClientSchema.partial()

export const clientFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: Category.optional(),
  billingMode: BillingMode.optional(),
  archived: z.coerce.boolean().default(false),
  search: z.string().max(100).trim().optional(),
})
