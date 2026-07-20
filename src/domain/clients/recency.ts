export const CLIENT_SILENCE_DAYS = 30

const DAY_MS = 86_400_000

/**
 * One grouped row of the recency aggregate: a client and the most recent
 * timestamp found across activity logs, meetings and completed tasks.
 */
export interface RecencyGroupRow {
  clientId: string
  lastContactAt: Date | string | null
}

export interface ClientRecencyEntry {
  lastContactAt: string | null
  silentDays: number | null
  isSilent: boolean
}

/**
 * Per-client silence map. A client with no row at all has no entry: the UI must
 * treat a missing entry as "unknown", never as "silent".
 */
export interface ClientsRecencySummary {
  byClient: Record<string, ClientRecencyEntry>
}

export const EMPTY_RECENCY_SUMMARY: ClientsRecencySummary = { byClient: {} }

function toDate(value: Date | string | null): Date | null {
  if (value === null) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Fold the grouped last-contact rows into the per-client silence summary.
 *
 * @param rows - One row per client that has at least one dated interaction.
 * @param now - Reference instant, injected so the fold stays deterministic.
 * @returns The per-client last contact (ISO), the silence duration in whole days
 *   (clamped at 0 for future timestamps, `null` when there is no contact), and
 *   the {@link CLIENT_SILENCE_DAYS} verdict.
 */
export function buildClientsRecencySummary(
  rows: readonly RecencyGroupRow[],
  now: Date,
): ClientsRecencySummary {
  const byClient: Record<string, ClientRecencyEntry> = {}

  for (const row of rows) {
    const last = toDate(row.lastContactAt)
    if (last === null) {
      byClient[row.clientId] = {
        lastContactAt: null,
        silentDays: null,
        isSilent: false,
      }
      continue
    }
    const raw = Math.floor((now.getTime() - last.getTime()) / DAY_MS)
    const silentDays = raw < 0 ? 0 : raw
    byClient[row.clientId] = {
      lastContactAt: last.toISOString(),
      silentDays,
      isSilent: silentDays >= CLIENT_SILENCE_DAYS,
    }
  }

  return { byClient }
}
