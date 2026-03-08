import { z } from "zod/v4"

/** Validates the global search query parameter. */
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100),
})
