import { z } from "zod/v4"

import { categoryFilterField } from "./category-filter"

export const taskFilterSchema = z.object({
  clientId: z.string().optional(),
  status: z.string().optional(),
  category: categoryFilterField,
})

export type TaskFilterInput = z.infer<typeof taskFilterSchema>
