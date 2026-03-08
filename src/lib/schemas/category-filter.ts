import { z } from "zod/v4"

/** Allowed project category values. */
export const CategorySchema = z.enum([
  "FREELANCE",
  "STUDY",
  "PERSONAL",
  "SIDE_PROJECT",
])

/** Reusable filter field that parses a comma-separated string into a category array. */
export const categoryFilterField = z
  .string()
  .transform((v) => v.split(","))
  .pipe(z.array(CategorySchema))
  .optional()

export type CategoryFilterValue = z.infer<typeof categoryFilterField>
