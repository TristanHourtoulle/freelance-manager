export interface DigestCounts {
  actions: number
  meetings: number
  overdueInvoices: number
}

export const DIGEST_TITLE = "Aujourd'hui"

function segment(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`
}

/**
 * Build the single daily digest notification body, in French.
 *
 * Returns `null` when there is nothing to report, which is the caller's
 * signal to send NO notification at all — an empty daily ping is the fastest
 * way to get the whole feature muted. Zero segments are omitted rather than
 * rendered as "0 action".
 *
 * @param counts - Items due today and invoices currently overdue.
 * @returns The notification body, or `null` when every count is zero.
 */
export function buildDigestBody(counts: DigestCounts): string | null {
  const parts: string[] = []

  if (counts.actions > 0) {
    parts.push(segment(counts.actions, "action", "actions"))
  }
  if (counts.meetings > 0) {
    parts.push(segment(counts.meetings, "RDV", "RDV"))
  }
  if (counts.overdueInvoices > 0) {
    parts.push(
      segment(
        counts.overdueInvoices,
        "facture en retard",
        "factures en retard",
      ),
    )
  }

  if (parts.length === 0) return null
  return parts.join(", ")
}
