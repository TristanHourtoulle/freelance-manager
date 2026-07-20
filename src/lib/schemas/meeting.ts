import { z } from "zod/v4"

const meetingBaseSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  teamsUrl: z.string().max(2000).trim().optional().nullable(),
  heldAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(0).max(100_000).default(0),
  participants: z.array(z.string().trim().min(1).max(160)).max(50).default([]),
  agendaMd: z.string().max(20_000).optional().nullable(),
  summaryMd: z.string().max(20_000).optional().nullable(),
})

export const meetingCreateSchema = meetingBaseSchema.extend({
  clientId: z.string().min(1),
})

export const meetingUpdateSchema = meetingBaseSchema.partial()

export type MeetingCreateInput = z.input<typeof meetingCreateSchema>
export type MeetingUpdateInput = z.input<typeof meetingUpdateSchema>
