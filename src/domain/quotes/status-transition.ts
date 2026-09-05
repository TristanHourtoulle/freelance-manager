import type { QuoteStatus } from "@/domain/quotes/types"

/**
 * Statuses that count as "decided" for a quote: the client has made a call,
 * one way or another (including the passive EXPIRED outcome).
 */
export const QUOTE_DECIDED_STATUSES: readonly QuoteStatus[] = [
  "ACCEPTED",
  "REFUSED",
  "EXPIRED",
]

export interface QuoteStatusTimestamps {
  status: QuoteStatus
  sentAt: Date | null
  decidedAt: Date | null
}

export interface QuoteStatusTimestampPatch {
  sentAt?: Date | null
  decidedAt?: Date | null
}

/**
 * Derive the `sentAt`/`decidedAt` patch for a quote status transition.
 *
 * Forward: the first move away from DRAFT stamps `sentAt`; the first move
 * into a decided status (ACCEPTED/REFUSED/EXPIRED) stamps `decidedAt`.
 * Backward: a move back to DRAFT clears both timestamps; a move back to SENT
 * from a decided status clears only `decidedAt` (the quote is still sent, no
 * longer decided). A lateral move between two decided statuses (e.g. REFUSED
 * -> ACCEPTED) leaves both timestamps untouched — there is no state machine
 * restricting hand-picked status corrections.
 *
 * @param existing - The quote's current status and timestamps.
 * @param nextStatus - The status the update is moving to.
 * @param now - Reference date used for a new stamp, injectable for tests.
 * @returns Only the keys that must change; a key absent from the patch means
 * the existing timestamp is left as-is.
 */
export function resolveQuoteStatusTimestamps(
  existing: QuoteStatusTimestamps,
  nextStatus: QuoteStatus,
  now: Date,
): QuoteStatusTimestampPatch {
  const patch: QuoteStatusTimestampPatch = {}

  if (nextStatus !== "DRAFT" && existing.sentAt == null) {
    patch.sentAt = now
  } else if (nextStatus === "DRAFT" && existing.sentAt != null) {
    patch.sentAt = null
  }

  const wasDecided = QUOTE_DECIDED_STATUSES.includes(existing.status)
  const isDecided = QUOTE_DECIDED_STATUSES.includes(nextStatus)

  if (isDecided && !wasDecided) {
    patch.decidedAt = now
  } else if (!isDecided && existing.decidedAt != null) {
    patch.decidedAt = null
  }

  return patch
}
