import { z } from "zod/v4"

/** Allowed lifecycle statuses for an invoice. */
export const InvoiceStatusSchema = z.enum(["DRAFT", "SENT", "PAID"])

/** Validates the request body when creating a new invoice. */
export const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  month: z.coerce.date(),
  totalAmount: z.number().min(0).default(0),
  status: InvoiceStatusSchema.default("DRAFT"),
})

/** Validates the request body when updating an existing invoice. */
export const updateInvoiceSchema = z.object({
  totalAmount: z.number().min(0).optional(),
  status: InvoiceStatusSchema.optional(),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
