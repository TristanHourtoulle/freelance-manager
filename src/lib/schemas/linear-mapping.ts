import { z } from "zod/v4"

export const linearMappingCreateSchema = z
  .object({
    clientId: z.string().min(1),
    linearTeamId: z.string().min(1).optional().nullable(),
    linearProjectId: z.string().min(1).optional().nullable(),
  })
  .refine((val) => Boolean(val.linearTeamId) || Boolean(val.linearProjectId), {
    message: "Provide at least linearTeamId or linearProjectId",
    path: ["linearTeamId"],
  })

export type LinearMappingCreateInput = z.input<typeof linearMappingCreateSchema>
