import { z } from "zod/v4"

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected YYYY-MM-DD")

export const paymentCreateSchema = z.object({
  amount: z.coerce.number().gt(0).max(10_000_000),
  paidAt: isoDate,
  method: z.string().max(60).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  penaltyAmount: z.coerce.number().min(0).max(10_000_000).default(0),
})

/**
 * Validate the cross-field invariant `penaltyAmount <= amount` for a parsed
 * {@link paymentCreateSchema} payload.
 *
 * Kept out of the schema itself (no `.refine`/`.superRefine`) so
 * `paymentCreateSchema` stays a plain `ZodObject` and can still be
 * `.extend()`-ed by `recordPaymentInput` in the MCP tool layer.
 *
 * @param data - The parsed payment payload.
 * @returns `true` when the payload is internally consistent.
 */
export function isPenaltyWithinAmount(data: {
  amount: number
  penaltyAmount: number
}): boolean {
  return data.penaltyAmount <= data.amount
}

export const paymentUpdateSchema = z.object({
  amount: z.coerce.number().gt(0).max(10_000_000).optional(),
  paidAt: isoDate.optional(),
  method: z.string().max(60).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
})

export type PaymentCreateInput = z.input<typeof paymentCreateSchema>
export type PaymentUpdateInput = z.input<typeof paymentUpdateSchema>
