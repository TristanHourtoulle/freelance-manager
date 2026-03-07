import { z } from "zod/v4"

export const InvoiceStatusSchema = z.enum(["DRAFT", "SENT", "PAID"])

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  month: z.coerce.date(),
  totalAmount: z.number().min(0).default(0),
  status: InvoiceStatusSchema.default("DRAFT"),
})

export const updateInvoiceSchema = z.object({
  totalAmount: z.number().min(0).optional(),
  status: InvoiceStatusSchema.optional(),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
