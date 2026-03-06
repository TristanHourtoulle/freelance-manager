import { z } from "zod/v4"

export const taskFilterSchema = z.object({
  clientId: z.string().optional(),
  status: z.string().optional(),
})

export type TaskFilterInput = z.infer<typeof taskFilterSchema>
