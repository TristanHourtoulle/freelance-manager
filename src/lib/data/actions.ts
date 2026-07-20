import "server-only"
import { Prisma } from "@/generated/prisma/client"

export type ClientActionType = "RELANCE" | "LINK" | "RDV" | "OTHER"
export type ClientActionStatus = "TODO" | "WAITING" | "DONE"

export interface ActionClientRef {
  id: string
  firstName: string
  lastName: string
  company: string | null
  color: string | null
}

export interface ActionWireRow {
  id: string
  clientId: string | null
  client: ActionClientRef | null
  type: ClientActionType
  title: string
  link: string | null
  notes: string | null
  status: ClientActionStatus
  dueDate: string | null
  doneAt: string | null
  invoiceId: string | null
  invoiceNumber: string | null
  meetingId: string | null
  createdAt: string
}

export const ACTION_INCLUDE = {
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      company: true,
      color: true,
    },
  },
  invoice: { select: { number: true } },
} satisfies Prisma.ClientActionInclude

type ActionRow = Prisma.ClientActionGetPayload<{
  include: typeof ACTION_INCLUDE
}>

export function serializeAction(a: ActionRow): ActionWireRow {
  return {
    id: a.id,
    clientId: a.clientId,
    client: a.client
      ? {
          id: a.client.id,
          firstName: a.client.firstName,
          lastName: a.client.lastName,
          company: a.client.company,
          color: a.client.color,
        }
      : null,
    type: a.type,
    title: a.title,
    link: a.link,
    notes: a.notes,
    status: a.status,
    dueDate: a.dueDate ? a.dueDate.toISOString() : null,
    doneAt: a.doneAt ? a.doneAt.toISOString() : null,
    invoiceId: a.invoiceId,
    invoiceNumber: a.invoice?.number ?? null,
    meetingId: a.meetingId,
    createdAt: a.createdAt.toISOString(),
  }
}
