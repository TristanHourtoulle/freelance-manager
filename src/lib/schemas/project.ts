import { z } from "zod/v4"

export const projectStatusSchema = z.enum(["ACTIVE", "PAUSED", "COMPLETED"])

/**
 * Linking a project = picking the Linear project we want to mirror locally.
 * The Linear project's name/key/description are then fetched server-side.
 */
export const projectLinkSchema = z.object({
  clientId: z.string().min(1),
  linearProjectId: z.string().min(1),
})

export const projectUpdateSchema = z.object({
  status: projectStatusSchema.optional(),
})

export type ProjectLinkInput = z.input<typeof projectLinkSchema>
export type ProjectUpdateInput = z.input<typeof projectUpdateSchema>
