export const CONCENTRATION_WARN_SHARE = 0.35
export const CONCENTRATION_DANGER_SHARE = 0.5

/**
 * Revenue and effort weight of a single client over the analytics period.
 *
 * Callers must pass **every** client, not a truncated top-N: the shares are
 * only meaningful when the denominator covers the whole book of business.
 */
export interface ClientWeightRow {
  clientId: string
  revenue: number
  days: number
}

/**
 * A {@link ClientWeightRow} enriched with its share of the global totals.
 *
 * Shares are unrounded fractions in `[0, 1]`, or `null` when the denominator is
 * zero or an input is non-finite — never `Infinity`, never `NaN`.
 */
export interface ClientShareRow extends ClientWeightRow {
  revenueShare: number | null
  daysShare: number | null
}

/**
 * Client-concentration verdict: how much of the business rides on one client.
 */
export interface ConcentrationSummary {
  rows: ClientShareRow[]
  totalRevenue: number
  totalDays: number
  topClientShare: number | null
  topThreeShare: number | null
  level: "ok" | "warn" | "danger"
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function share(part: number, total: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(total)) return null
  if (total <= 0) return null
  const result = part / total
  return Number.isFinite(result) ? result : null
}

/**
 * Compute the client-concentration summary over every client of the period.
 *
 * The totals are summed over all input rows before any sorting or truncation,
 * so a caller that later slices to a top-5 list still renders true shares of the
 * whole business rather than shares of the slice.
 *
 * @param rows - Revenue and effort weight for every client, untruncated.
 * @returns The per-client shares (sorted by revenue descending, ties broken by
 *   `clientId` ascending), the global totals, the top-1 and top-3 revenue
 *   shares, and the threshold verdict.
 */
export function buildConcentration(
  rows: readonly ClientWeightRow[],
): ConcentrationSummary {
  let totalRevenue = 0
  let totalDays = 0
  for (const row of rows) {
    totalRevenue += finiteOrZero(row.revenue)
    totalDays += finiteOrZero(row.days)
  }

  const sorted = [...rows].sort((a, b) => {
    const revA = finiteOrZero(a.revenue)
    const revB = finiteOrZero(b.revenue)
    if (revA !== revB) return revB - revA
    return a.clientId < b.clientId ? -1 : a.clientId > b.clientId ? 1 : 0
  })

  const shareRows: ClientShareRow[] = sorted.map((row) => ({
    clientId: row.clientId,
    revenue: row.revenue,
    days: row.days,
    revenueShare: share(row.revenue, totalRevenue),
    daysShare: share(row.days, totalDays),
  }))

  const topThreeRevenue = sorted
    .slice(0, 3)
    .reduce((sum, row) => sum + finiteOrZero(row.revenue), 0)

  const topClientShare = shareRows[0]?.revenueShare ?? null
  const topThreeShare = share(topThreeRevenue, totalRevenue)

  const level: ConcentrationSummary["level"] =
    topClientShare === null
      ? "ok"
      : topClientShare >= CONCENTRATION_DANGER_SHARE
        ? "danger"
        : topClientShare >= CONCENTRATION_WARN_SHARE
          ? "warn"
          : "ok"

  return {
    rows: shareRows,
    totalRevenue,
    totalDays,
    topClientShare,
    topThreeShare,
    level,
  }
}
