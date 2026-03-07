import { z } from "zod/v4"

export const CategorySchema = z.enum([
  "FREELANCE",
  "STUDY",
  "PERSONAL",
  "SIDE_PROJECT",
])

export const categoryFilterField = z
  .string()
  .transform((v) => v.split(","))
  .pipe(z.array(CategorySchema))
  .optional()

export type CategoryFilterValue = z.infer<typeof categoryFilterField>
