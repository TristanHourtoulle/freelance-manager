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

const optionalUrl = z
  .union([z.url({ protocol: /^https?$/ }).trim(), z.literal("")])
  .nullish()
  .transform((v) => (v ? v : null))

/**
 * App-owned edits on a mirrored project: the three access URLs, the markdown
 * runbook and the local status. Linear-mirrored columns are never accepted
 * here.
 */
export const projectUpdateSchema = z.object({
  status: projectStatusSchema.optional(),
  repoUrl: optionalUrl,
  stagingUrl: optionalUrl,
  prodUrl: optionalUrl,
  runbook: z
    .string()
    .max(20_000)
    .nullish()
    .transform((v) => (v && v.trim() ? v : null)),
})

export type ProjectLinkInput = z.input<typeof projectLinkSchema>
export type ProjectUpdateInput = z.input<typeof projectUpdateSchema>
