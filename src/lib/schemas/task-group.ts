import { z } from "zod/v4"

const uniqueTaskIds = z
  .array(z.string().min(1))
  .min(1)
  .max(200)
  .superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "A task can only appear once in a group",
      })
    }
  })

export const taskGroupCreateSchema = z
  .object({
    clientId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    taskIds: uniqueTaskIds,
  })
  .strict()

// Deliberately excludes clientId: a group can never move across clients.
export const taskGroupUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    taskIds: uniqueTaskIds,
  })
  .strict()

export const taskGroupListSchema = z.object({
  clientId: z.string().min(1).optional(),
  status: z.enum(["pending", "invoiced", "all"]).default("pending"),
})

export type TaskGroupCreateInput = z.input<typeof taskGroupCreateSchema>
export type TaskGroupUpdateInput = z.input<typeof taskGroupUpdateSchema>
