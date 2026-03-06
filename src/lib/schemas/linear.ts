import { z } from "zod/v4"

export const linearProjectsFilterSchema = z.object({
  teamId: z.string().min(1).optional(),
})

export type LinearProjectsFilter = z.infer<typeof linearProjectsFilterSchema>

export const linearIssuesFilterSchema = z.object({
  teamId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
})

export type LinearIssuesFilter = z.infer<typeof linearIssuesFilterSchema>
