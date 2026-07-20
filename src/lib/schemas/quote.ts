import { z } from "zod/v4"

export const quoteStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REFUSED",
  "EXPIRED",
])

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected YYYY-MM-DD")

const quoteLineSchema = z.object({
  taskId: z.string().optional().nullable(),
  label: z.string().min(1).max(240),
  qty: z.coerce.number().min(0).max(100_000),
  rate: z.coerce.number().min(0).max(10_000_000),
})

const externalUrlSchema = z.url().max(500).optional().nullable()

export const quoteCreateSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  number: z.string().min(1).max(40).optional(),
  status: quoteStatusSchema.default("DRAFT"),
  issueDate: isoDate,
  validUntil: isoDate.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  externalUrl: externalUrlSchema,
  lines: z.array(quoteLineSchema).min(1),
})

export const quoteUpdateSchema = z.object({
  projectId: z.string().optional().nullable(),
  number: z.string().min(1).max(40).optional(),
  status: quoteStatusSchema,
  issueDate: isoDate,
  validUntil: isoDate.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  externalUrl: externalUrlSchema,
  lines: z.array(quoteLineSchema).min(1),
})

export const quoteStatusUpdateSchema = z.object({
  status: quoteStatusSchema,
})

export const quoteFilterSchema = z.object({
  search: z.string().optional(),
  status: quoteStatusSchema.optional(),
  clientId: z.string().optional(),
})

export type QuoteCreateInput = z.input<typeof quoteCreateSchema>
export type QuoteUpdateInput = z.input<typeof quoteUpdateSchema>
export type QuoteStatusUpdateInput = z.input<typeof quoteStatusUpdateSchema>
export type QuoteFilterInput = z.input<typeof quoteFilterSchema>
export type QuoteLineInput = z.input<typeof quoteLineSchema>
