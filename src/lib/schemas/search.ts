import { z } from "zod/v4"

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
})
