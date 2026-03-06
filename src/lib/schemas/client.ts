import { z } from "zod/v4"

export const BillingModeSchema = z.enum(["HOURLY", "DAILY", "FIXED", "FREE"])
export const CategorySchema = z.enum([
  "FREELANCE",
  "STUDY",
  "PERSONAL",
  "SIDE_PROJECT",
])

export const createClientSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.email().optional(),
  company: z.string().max(100).trim().optional(),
  billingMode: BillingModeSchema.default("HOURLY"),
  rate: z.number().min(0).default(0),
  category: CategorySchema.default("FREELANCE"),
  notes: z.string().max(2000).trim().optional(),
})

export const updateClientSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.email().optional(),
  company: z.string().max(100).trim().optional(),
  billingMode: BillingModeSchema.optional(),
  rate: z.number().min(0).optional(),
  category: CategorySchema.optional(),
  notes: z.string().max(2000).trim().optional(),
})

export const clientFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: CategorySchema.optional(),
  billingMode: BillingModeSchema.optional(),
  archived: z.coerce.boolean().default(false),
  search: z.string().max(100).trim().optional(),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type ClientFilter = z.infer<typeof clientFilterSchema>
