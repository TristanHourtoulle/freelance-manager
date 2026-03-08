import { z } from "zod/v4"

/** Validates query parameters when listing Linear projects. */
export const linearProjectsFilterSchema = z.object({
  teamId: z.string().min(1).optional(),
})

export type LinearProjectsFilter = z.infer<typeof linearProjectsFilterSchema>

/** Validates query parameters when listing Linear issues. */
export const linearIssuesFilterSchema = z.object({
  teamId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
})

export type LinearIssuesFilter = z.infer<typeof linearIssuesFilterSchema>

/** Validates the request body when updating a Linear issue estimate. */
export const updateEstimateSchema = z.object({
  estimate: z.number().int().min(0).max(100),
})

/** Validates the request body when creating a new Linear issue. */
export const createLinearIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().optional(),
  estimate: z.number().int().positive().optional(),
  teamId: z.string().min(1, "Team is required"),
  projectId: z.string().min(1, "Project is required"),
  assigneeId: z.string().min(1).optional(),
  stateId: z.string().min(1).optional(),
  labelIds: z.array(z.string().min(1)).optional(),
})

export type CreateLinearIssueInput = z.infer<typeof createLinearIssueSchema>
