import type { Prisma } from "@/generated/prisma/client"
import { decimalToNumber } from "@/lib/api"
import type { QuoteLineDTO, QuoteStatus, QuoteWireRow } from "./types"

export interface QuoteRowForSerialize {
  id: string
  number: string
  clientId: string
  projectId: string | null
  status: QuoteStatus
  issueDate: Date
  validUntil: Date | null
  sentAt: Date | null
  decidedAt: Date | null
  subtotal: Prisma.Decimal
  total: Prisma.Decimal
  notes: string | null
  externalUrl: string | null
  createdAt: Date
  _count: { lines: number }
}

export interface QuoteLineRowForSerialize {
  id: string
  taskId: string | null
  label: string
  qty: Prisma.Decimal
  rate: Prisma.Decimal
}

/**
 * Sole mapper from a Prisma quote row (with `_count.lines`) to the canonical
 * {@link QuoteWireRow}.
 */
export function serializeQuote(q: QuoteRowForSerialize): QuoteWireRow {
  return {
    id: q.id,
    number: q.number,
    clientId: q.clientId,
    projectId: q.projectId,
    status: q.status,
    issueDate: q.issueDate.toISOString(),
    validUntil: q.validUntil?.toISOString() ?? null,
    sentAt: q.sentAt?.toISOString() ?? null,
    decidedAt: q.decidedAt?.toISOString() ?? null,
    subtotal: decimalToNumber(q.subtotal) ?? 0,
    total: decimalToNumber(q.total) ?? 0,
    notes: q.notes,
    externalUrl: q.externalUrl,
    linesCount: q._count.lines,
    createdAt: q.createdAt.toISOString(),
  }
}

/**
 * Sole mapper from a Prisma quote line row to the canonical
 * {@link QuoteLineDTO}.
 */
export function serializeQuoteLine(l: QuoteLineRowForSerialize): QuoteLineDTO {
  return {
    id: l.id,
    taskId: l.taskId,
    label: l.label,
    qty: decimalToNumber(l.qty) ?? 0,
    rate: decimalToNumber(l.rate) ?? 0,
  }
}
