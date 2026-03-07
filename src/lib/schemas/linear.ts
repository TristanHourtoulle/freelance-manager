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

export const updateEstimateSchema = z.object({
  estimate: z.number().int().min(0).max(100),
})

export const createLinearIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  estimate: z.number().int().positive().optional(),
  teamId: z.string().min(1, "Team is required"),
  projectId: z.string().min(1, "Project is required"),
})

export type CreateLinearIssueInput = z.infer<typeof createLinearIssueSchema>
