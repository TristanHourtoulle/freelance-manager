const MS_PER_DAY = 86_400_000

const parisOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris",
  timeZoneName: "shortOffset",
})

function parisOffsetMinutes(date: Date): number {
  const noonUtc = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      12,
    ),
  )
  const zonePart = parisOffsetFormatter
    .formatToParts(noonUtc)
    .find((part) => part.type === "timeZoneName")?.value
  const match = zonePart ? /GMT([+-]\d+)/.exec(zonePart) : null
  return match ? Number(match[1]) * 60 : 60
}

/**
 * The instant "23:59:59.999 Europe/Paris" on the UTC calendar day encoded by
 * `validUntil`.
 *
 * `validUntil` is always written from an `<input type="date">` as
 * `new Date("YYYY-MM-DD")`, i.e. midnight UTC of the picked day — so its
 * UTC year/month/date components are the picked day itself, independent of
 * server timezone. Europe/Paris is used (not UTC) because the freelancer and
 * their clients are French: a UTC-anchored end-of-day would cut a quote's
 * last evening short by 1-2h (CET/CEST). The offset is resolved per-day so
 * the DST transition (last Sunday of March/October) is handled correctly.
 *
 * @param validUntil - A quote's `validUntil` column value.
 * @returns The UTC instant marking the end of that day's validity.
 */
export function parisEndOfDay(validUntil: Date): Date {
  const dayStartUtc = Date.UTC(
    validUntil.getUTCFullYear(),
    validUntil.getUTCMonth(),
    validUntil.getUTCDate(),
  )
  const offsetMs = parisOffsetMinutes(validUntil) * 60_000
  return new Date(dayStartUtc + MS_PER_DAY - 1 - offsetMs)
}

/**
 * Whether a quote's validity window ("valable jusqu'au D") has elapsed at
 * `now`. This is the single rule shared by the daily expiry cron
 * (`runDailyJobs` -> `expire-quotes`) and the sidebar badge count
 * (`getNavCounts`), so the two can never disagree.
 *
 * A `null` `validUntil` never expires. Otherwise the quote stays valid
 * through the whole of its `validUntil` day in French local time (see
 * {@link parisEndOfDay}): a quote "valable jusqu'au 1 août" is live for all
 * of August 1st in France and only expires once that day is over there.
 *
 * @param validUntil - The quote's `validUntil` column value.
 * @param now - Reference instant (injectable for deterministic tests).
 * @returns `true` once `now` is strictly past the end of the valid day.
 */
export function isQuoteExpired(validUntil: Date | null, now: Date): boolean {
  if (validUntil == null) return false
  return now.getTime() > parisEndOfDay(validUntil).getTime()
}

/**
 * The smallest `validUntil` value (a UTC-midnight `Date`, matching how the
 * column is always written) for which a quote is NOT expired at `now`.
 *
 * Built directly on {@link isQuoteExpired} — never duplicates the Paris
 * end-of-day math — so it stays usable as a Prisma `validUntil: { gte }`
 * bound while remaining impossible to drift from the cron's own rule.
 *
 * @param now - Reference instant (injectable for deterministic tests).
 * @returns A UTC-midnight `Date` suitable for `validUntil: { gte }`.
 */
export function quoteBadgeCutoff(now: Date): Date {
  const todayUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  return isQuoteExpired(todayUtcMidnight, now)
    ? new Date(todayUtcMidnight.getTime() + MS_PER_DAY)
    : todayUtcMidnight
}
