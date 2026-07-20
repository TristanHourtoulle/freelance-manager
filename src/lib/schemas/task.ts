import { z } from "zod/v4"

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
