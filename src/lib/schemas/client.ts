import { z } from "zod/v4"

export const billingModeSchema = z.enum(["DAILY", "FIXED", "HOURLY"])

export const clientCategorySchema = z.enum([
  "FREELANCE",
  "STUDY",
  "PERSONAL",
  "SIDE_PROJECT",
])

const clientBaseSchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  lastName: z.string().min(1).max(80).trim(),
  company: z.string().max(120).trim().optional().nullable(),
  email: z.email().max(160).optional().nullable(),
  phone: z.string().max(40).trim().optional().nullable(),
  billingMode: billingModeSchema.default("DAILY"),
  rate: z.coerce.number().min(0).max(100_000).default(0),
  fixedPrice: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  deposit: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  paymentTerms: z.coerce.number().int().min(0).max(180).optional().nullable(),
  category: clientCategorySchema.default("FREELANCE"),
  color: z.string().max(160).optional().nullable(),
})

export const clientCreateSchema = clientBaseSchema.superRefine((val, ctx) => {
  if (val.billingMode === "FIXED" && (val.fixedPrice ?? 0) <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["fixedPrice"],
      message: "fixedPrice is required for FIXED billing mode",
    })
  }
})

export const clientUpdateSchema = clientBaseSchema.partial()

export const clientFilterSchema = z.object({
  search: z.string().optional(),
  billingMode: billingModeSchema.optional(),
  category: clientCategorySchema.optional(),
  archived: z.coerce.boolean().optional(),
})

export type ClientCreateInput = z.input<typeof clientCreateSchema>
export type ClientUpdateInput = z.input<typeof clientUpdateSchema>
export type ClientFilterInput = z.input<typeof clientFilterSchema>
