import "server-only"
import { Prisma } from "@/generated/prisma/client"
import type { ActionClientRef } from "@/lib/data/actions"

export interface MeetingWireRow {
  id: string
  clientId: string
  client: ActionClientRef
  title: string
  teamsUrl: string | null
  heldAt: string
  durationMinutes: number
  participants: string[]
  summaryMd: string | null
  createdAt: string
}

export const MEETING_INCLUDE = {
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      color: true,
    },
  },
} satisfies Prisma.MeetingInclude

type MeetingRow = Prisma.MeetingGetPayload<{ include: typeof MEETING_INCLUDE }>

export function serializeMeeting(m: MeetingRow): MeetingWireRow {
  return {
    id: m.id,
    clientId: m.clientId,
    client: {
      id: m.client.id,
      firstName: m.client.firstName,
      lastName: m.client.lastName,
      company: m.client.company,
      color: m.client.color,
    },
    title: m.title,
    teamsUrl: m.teamsUrl,
    heldAt: m.heldAt.toISOString(),
    durationMinutes: m.durationMinutes,
    participants: m.participants,
    summaryMd: m.summaryMd,
    createdAt: m.createdAt.toISOString(),
  }
}
