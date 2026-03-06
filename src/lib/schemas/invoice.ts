import { z } from "zod/v4"

export const InvoiceStatus = z.enum(["DRAFT", "SENT", "PAID"])

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1),
  month: z.iso.datetime(),
  totalAmount: z.number().min(0).default(0),
  status: InvoiceStatus.default("DRAFT"),
})

export const updateInvoiceSchema = z.object({
  totalAmount: z.number().min(0).optional(),
  status: InvoiceStatus.optional(),
})
