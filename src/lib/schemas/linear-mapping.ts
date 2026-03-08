import { z } from "zod/v4"

/** Validates full payload (including clientId) when creating a Linear mapping. */
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

/** Validates the request body (without clientId) when creating a Linear mapping. */
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
