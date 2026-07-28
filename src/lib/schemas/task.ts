import { z } from "zod/v4"
import { validateBillability } from "@/domain/tasks/billability"

export const taskStatusSchema = z.enum([
  "BACKLOG",
  "IN_PROGRESS",
  "PENDING_INVOICE",
  "DONE",
  "CANCELED",
])

export const taskPrioritySchema = z.enum([
  "NONE",
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
])

export const taskFilterSchema = z.object({
  search: z.string().optional(),
  status: taskStatusSchema.optional(),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
})

export type TaskFilterInput = z.input<typeof taskFilterSchema>

export const taskUpdateSchema = z.object({
  actualDays: z.coerce.number().min(0).max(9999.99).nullable().optional(),
})

export type TaskUpdateInput = z.input<typeof taskUpdateSchema>

export const nonBillableReasonSchema = z.enum([
  "BUG_FIX_ALREADY_INVOICED",
  "NON_BILLED_WORK",
  "COMMERCIAL_GESTURE",
  "OTHER",
])

export const taskBillabilitySchema = z
  .object({
    billable: z.boolean(),
    nonBillableReason: nonBillableReasonSchema.nullable().default(null),
    nonBillableNote: z.string().max(500).nullable().default(null),
  })
  .superRefine((value, ctx) => {
    const result = validateBillability(value)
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.error })
    }
  })

export type TaskBillabilityWireInput = z.input<typeof taskBillabilitySchema>
