import type { QuoteStatus } from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

export interface QuoteKpiRow {
  status: QuoteStatus
  sentAt: string | null
  decidedAt: string | null
  total: number
}

export interface QuoteKpis {
  winRate: number
  avgDecisionDays: number
  pipelineValue: number
}

/**
 * Sales-funnel KPIs derived from serialized quote rows.
 *
 * `winRate` counts only decided quotes (ACCEPTED / REFUSED / EXPIRED);
 * DRAFT and SENT are undecided and excluded from both sides of the ratio.
 *
 * @param quotes Serialized quote rows for the user.
 * @returns Win rate in percent, mean decision delay in whole days, and the
 *   euro value still open (DRAFT + SENT).
 */
export function computeQuoteKpis(quotes: readonly QuoteKpiRow[]): QuoteKpis {
  let accepted = 0
  let decided = 0
  let pipelineValue = 0
  let delaySum = 0
  let delayCount = 0

  for (const q of quotes) {
    if (q.status === "ACCEPTED") {
      accepted += 1
      decided += 1
    } else if (q.status === "REFUSED" || q.status === "EXPIRED") {
      decided += 1
    } else {
      pipelineValue += q.total
    }

    if (q.sentAt && q.decidedAt) {
      const delta =
        new Date(q.decidedAt).getTime() - new Date(q.sentAt).getTime()
      if (delta >= 0) {
        delaySum += delta / DAY_MS
        delayCount += 1
      }
    }
  }

  return {
    winRate: decided > 0 ? Math.round((accepted / decided) * 100) : 0,
    avgDecisionDays: delayCount > 0 ? Math.round(delaySum / delayCount) : 0,
    pipelineValue,
  }
}
