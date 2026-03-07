import { z } from "zod/v4"

export const createLinearMappingSchema = z
  .object({
    clientId: z.string().min(1),
    linearTeamId: z.string().min(1).optional(),
    linearProjectId: z.string().min(1).optional(),
  })
  .refine((data) => data.linearTeamId || data.linearProjectId, {
    message: "At least one of linearTeamId or linearProjectId is required",
  })

export type CreateLinearMappingInput = z.infer<typeof createLinearMappingSchema>

export const createLinearMappingBodySchema = z
  .object({
    linearTeamId: z.string().min(1).optional(),
    linearProjectId: z.string().min(1).optional(),
  })
  .refine((data) => data.linearTeamId || data.linearProjectId, {
    message: "At least one of linearTeamId or linearProjectId is required",
  })

export type CreateLinearMappingBody = z.infer<
  typeof createLinearMappingBodySchema
>
