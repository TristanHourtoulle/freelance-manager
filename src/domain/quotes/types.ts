/**
 * Canonical quote (devis) wire types.
 *
 * Quotes are TRACK-ONLY: this app never emits the document. `externalUrl`
 * points at the Abby.fr devis, which remains the single legally binding
 * source of truth. Pure module: no React, no `next/*`, no Prisma runtime
 * import.
 */

export type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REFUSED" | "EXPIRED"

export interface QuoteWireRow {
  id: string
  number: string
  clientId: string
  projectId: string | null
  status: QuoteStatus
  issueDate: string
  validUntil: string | null
  sentAt: string | null
  decidedAt: string | null
  subtotal: number
  total: number
  notes: string | null
  externalUrl: string | null
  linesCount: number
  createdAt: string
}

export interface QuoteLineDTO {
  id: string
  taskId: string | null
  label: string
  qty: number
  rate: number
}

export interface QuoteDetail extends QuoteWireRow {
  client: {
    id: string
    firstName: string
    lastName: string
    company: string | null
    billingMode: "DAILY" | "FIXED" | "HOURLY"
    color: string | null
  }
  lines: QuoteLineDTO[]
}
