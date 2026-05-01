import { z } from "zod/v4"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected YYYY-MM-DD")

export const paymentCreateSchema = z.object({
  amount: z.coerce.number().gt(0).max(10_000_000),
  paidAt: isoDate,
  method: z.string().max(60).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
})

export const paymentUpdateSchema = z.object({
  amount: z.coerce.number().gt(0).max(10_000_000).optional(),
  paidAt: isoDate.optional(),
  method: z.string().max(60).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
})

export type PaymentCreateInput = z.input<typeof paymentCreateSchema>
export type PaymentUpdateInput = z.input<typeof paymentUpdateSchema>
