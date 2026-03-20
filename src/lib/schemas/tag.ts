import { z } from "zod/v4"

/** Hex color pattern: #RGB or #RRGGBB */
const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
  message: "Must be a valid hex color (e.g. #6b7280)",
})

/** Validates the request body when creating a new tag. */
export const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: hexColorSchema.default("#6b7280"),
})

/** Validates the request body when updating an existing tag. */
export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  color: hexColorSchema.optional(),
})

export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>
