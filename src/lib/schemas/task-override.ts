import { z } from "zod/v4"

/** Validates the request body when creating a task override. */
export const createTaskOverrideSchema = z.object({
  clientId: z.string().min(1),
  linearIssueId: z.string().min(1),
  toInvoice: z.boolean().default(false),
  invoiced: z.boolean().default(false),
  invoicedAt: z.coerce.date().optional(),
  rateOverride: z.number().min(0).optional(),
})

/** Validates the request body when partially updating a task override. */
export const updateTaskOverrideSchema = z.object({
  toInvoice: z.boolean().optional(),
  invoiced: z.boolean().optional(),
  invoicedAt: z.coerce.date().optional(),
  rateOverride: z.number().min(0).nullable().optional(),
})

/** Validates the request body when upserting a task override by Linear issue ID. */
export const upsertTaskOverrideSchema = z.object({
  clientId: z.string().min(1),
  toInvoice: z.boolean().optional(),
  invoiced: z.boolean().optional(),
  invoicedAt: z.coerce.date().optional(),
  rateOverride: z.number().min(0).nullable().optional(),
})

export type CreateTaskOverrideInput = z.infer<typeof createTaskOverrideSchema>
export type UpdateTaskOverrideInput = z.infer<typeof updateTaskOverrideSchema>
export type UpsertTaskOverrideInput = z.infer<typeof upsertTaskOverrideSchema>
