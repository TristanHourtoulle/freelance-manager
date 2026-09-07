export interface MonthTotalRow {
  month: Date
  total: number
}

export interface MonthlyBucket {
  label: string
  paid: number
  issued: number
  isCurrent: boolean
}

function monthKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 7)
}

/**
 * Build the trailing monthly revenue buckets for the analytics dashboard.
 *
 * Every boundary is derived from the UTC calendar (`Date.UTC`,
 * `getUTCFullYear`, `getUTCMonth`) so the same `referenceDate` produces the
 * same buckets regardless of the server process's local timezone. Building a
 * bucket start with the local-time constructor (`new Date(y, m, 1)`) and then
 * reading it back with `toISOString()` shifts every key by one month in any
 * positive-UTC-offset timezone, because local midnight on the 1st is still
 * the previous UTC day.
 *
 * `paidByMonth` and `issuedByMonth` are expected to already carry
 * UTC-normalized month starts (Postgres `date_trunc('month', ...)` via
 * `@prisma/adapter-pg`, which round-trips `DateTime` in UTC regardless of
 * process timezone), so they are keyed the same way.
 *
 * @param referenceDate - The instant to count back from; only its UTC
 *   calendar year and month are used.
 * @param months - Number of trailing months to build, oldest first.
 * @param paidByMonth - Per-month paid totals, keyed by their UTC month start.
 * @param issuedByMonth - Per-month issued totals, keyed by their UTC month
 *   start.
 * @returns One bucket per month, oldest first, with the last entry being the
 *   current month.
 */
export function buildMonthlyBuckets(
  referenceDate: Date,
  months: number,
  paidByMonth: readonly MonthTotalRow[],
  issuedByMonth: readonly MonthTotalRow[],
): MonthlyBucket[] {
  const paidByMonthMap = new Map(
    paidByMonth.map((b) => [monthKeyUTC(b.month), b.total]),
  )
  const issuedByMonthMap = new Map(
    issuedByMonth.map((b) => [monthKeyUTC(b.month), b.total]),
  )

  const buckets: MonthlyBucket[] = []
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth() - i,
        1,
      ),
    )
    const key = monthKeyUTC(start)
    buckets.push({
      label: start.toLocaleDateString("fr-FR", {
        month: "short",
        timeZone: "UTC",
      }),
      paid: paidByMonthMap.get(key) ?? 0,
      issued: issuedByMonthMap.get(key) ?? 0,
      isCurrent: i === 0,
    })
  }
  return buckets
}
