import { z } from "zod/v4"

import { CategorySchema, categoryFilterField } from "./category-filter"

/** Validates client category values (re-exported from category-filter). */
export { CategorySchema }

/** Allowed billing modes for a client. */
export const BillingModeSchema = z.enum(["HOURLY", "DAILY", "FIXED", "FREE"])

/** Validates the request body when creating a new client. */
export const createClientSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.email().optional(),
  company: z.string().max(100).trim().optional(),
  billingMode: BillingModeSchema.default("HOURLY"),
  rate: z.number().min(0).default(0),
  category: CategorySchema.default("FREELANCE"),
  notes: z.string().max(2000).trim().optional(),
})

/** Validates the request body when updating an existing client (all fields optional). */
export const updateClientSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  email: z.email().optional(),
  company: z.string().max(100).trim().optional(),
  billingMode: BillingModeSchema.optional(),
  rate: z.number().min(0).optional(),
  category: CategorySchema.optional(),
  notes: z.string().max(2000).trim().optional(),
})

/** Allowed sort-by columns for the client list. */
export const SortBySchema = z
  .enum(["name", "revenue", "lastActivity", "createdAt"])
  .default("createdAt")

/** Sort direction (ascending or descending). */
export const SortOrderSchema = z.enum(["asc", "desc"]).default("desc")

/** Validates query parameters for the client list endpoint. */
export const clientFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: categoryFilterField,
  billingMode: BillingModeSchema.optional(),
  archived: z.coerce.boolean().default(false),
  search: z.string().max(100).trim().optional(),
  sortBy: SortBySchema,
  sortOrder: SortOrderSchema,
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type ClientFilter = z.infer<typeof clientFilterSchema>
