import { z } from "zod/v4"

export const createClientNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
})

export const updateClientNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
})

export type CreateClientNoteInput = z.infer<typeof createClientNoteSchema>
export type UpdateClientNoteInput = z.infer<typeof updateClientNoteSchema>
