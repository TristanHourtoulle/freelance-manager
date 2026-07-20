import { z } from "zod/v4"

export const clientActionTypeSchema = z.enum([
  "RELANCE",
  "LINK",
  "RDV",
  "OTHER",
])
export const clientActionStatusSchema = z.enum(["TODO", "DONE"])

const actionBaseSchema = z.object({
  type: clientActionTypeSchema.default("OTHER"),
  title: z.string().min(1).max(200).trim(),
  link: z.string().max(2000).trim().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  invoiceId: z.string().min(1).optional().nullable(),
  meetingId: z.string().min(1).optional().nullable(),
})

/** Query-string sentinel selecting only actions that carry no client. */
export const UNASSIGNED_CLIENT_FILTER = "none" as const

export const actionCreateSchema = actionBaseSchema.extend({
  clientId: z.string().min(1).optional().nullable(),
})

export const actionUpdateSchema = actionBaseSchema
  .extend({
    status: clientActionStatusSchema,
    clientId: z.string().min(1).nullable(),
  })
  .partial()

export const actionFilterSchema = z.object({
  clientId: z.string().optional(),
  status: clientActionStatusSchema.optional(),
  type: clientActionTypeSchema.optional(),
})

export type ActionCreateInput = z.input<typeof actionCreateSchema>
export type ActionUpdateInput = z.input<typeof actionUpdateSchema>
