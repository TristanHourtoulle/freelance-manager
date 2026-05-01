import { z } from "zod/v4"

export const invoiceStatusSchema = z.enum(["DRAFT", "SENT", "CANCELLED"])

export const invoiceKindSchema = z.enum(["STANDARD", "DEPOSIT"])

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Expected YYYY-MM-DD")

const invoiceLineSchema = z.object({
  taskId: z.string().optional().nullable(),
  label: z.string().min(1).max(240),
  qty: z.coerce.number().min(0).max(100_000),
  rate: z.coerce.number().min(0).max(10_000_000),
})

const optionalNumber = z.coerce
  .number()
  .min(0)
  .max(10_000_000)
  .optional()
  .nullable()

const optionalNumberString = z.string().min(1).max(40).optional()

const initialPaymentSchema = z
  .object({
    amount: z.coerce.number().gt(0).max(10_000_000),
    paidAt: isoDate,
    method: z.string().max(60).optional().nullable(),
    note: z.string().max(500).optional().nullable(),
  })
  .optional()
  .nullable()

export const invoiceCreateSchema = z
  .object({
    clientId: z.string().min(1),
    projectId: z.string().optional().nullable(),
    number: optionalNumberString,
    kind: invoiceKindSchema.default("STANDARD"),
    status: invoiceStatusSchema.default("DRAFT"),
    issueDate: isoDate,
    dueDate: isoDate,
    notes: z.string().max(2000).optional().nullable(),
    totalOverride: optionalNumber,
    lines: z.array(invoiceLineSchema).min(1),
    taskIds: z.array(z.string()).optional(),
    initialPayment: initialPaymentSchema,
  })
  .superRefine((val, ctx) => {
    if (val.kind === "DEPOSIT" && val.lines.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Deposit invoice must have exactly one line",
      })
    }
  })

export const invoiceStatusUpdateSchema = z.object({
  status: invoiceStatusSchema,
})

/**
 * Full invoice update: dates, kind, status, notes, lines (replaced wholesale),
 * optional taskIds re-binding, optional invoice number override and optional
 * total override (forfait mode). Lines are min 1 — empty invoices forbidden.
 */
export const invoiceUpdateSchema = z
  .object({
    projectId: z.string().optional().nullable(),
    number: optionalNumberString,
    kind: invoiceKindSchema,
    status: invoiceStatusSchema,
    issueDate: isoDate,
    dueDate: isoDate,
    notes: z.string().max(2000).optional().nullable(),
    totalOverride: optionalNumber,
    lines: z.array(invoiceLineSchema).min(1),
    taskIds: z.array(z.string()).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "DEPOSIT" && val.lines.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Deposit invoice must have exactly one line",
      })
    }
  })

export const invoiceFilterSchema = z.object({
  search: z.string().optional(),
  status: invoiceStatusSchema.optional(),
  clientId: z.string().optional(),
})

export type InvoiceCreateInput = z.input<typeof invoiceCreateSchema>
export type InvoiceUpdateInput = z.input<typeof invoiceUpdateSchema>
export type InvoiceStatusUpdateInput = z.input<typeof invoiceStatusUpdateSchema>
export type InvoiceFilterInput = z.input<typeof invoiceFilterSchema>
export type InvoiceLineInput = z.input<typeof invoiceLineSchema>
