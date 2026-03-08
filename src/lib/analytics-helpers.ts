import { fetchLinearIssues } from "@/lib/linear-service"
import { calculateBilling } from "@/lib/billing"

import type {
  BillingMode,
  TaskOverride,
  Client,
  LinearMapping,
} from "@/generated/prisma/client"
import type { UtilizationMonth } from "@/components/analytics/types"

/** Task override joined with its parent client and Linear mappings. */
export type OverrideWithClient = TaskOverride & {
  client: Client & { linearMappings: LinearMapping[] }
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/**
 * Converts a Date into a "YYYY-MM" month key string.
 *
 * @param date - The date to convert
 * @returns Month key in "YYYY-MM" format
 *
 * @example
 * ```ts
 * getMonthKey(new Date("2026-03-15")) // => "2026-03"
 * ```
 */
export function getMonthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

/**
 * Returns the abbreviated month label for a "YYYY-MM" key.
 *
 * @param key - Month key in "YYYY-MM" format
 * @returns Abbreviated month name (e.g. "Jan", "Feb")
 *
 * @example
 * ```ts
 * getMonthLabel("2026-03") // => "Mar"
 * ```
 */
export function getMonthLabel(key: string): string {
  const month = parseInt(key.split("-")[1]!, 10)
  return MONTH_LABELS[month - 1]!
}

const FULL_MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

/**
 * Returns the full month label with year for a "YYYY-MM" key.
 *
 * @param key - Month key in "YYYY-MM" format
 * @returns Full label (e.g. "March 2026")
 */
export function getFullMonthLabel(key: string): string {
  const month = parseInt(key.split("-")[1]!, 10)
  const year = key.split("-")[0]
  return `${FULL_MONTH_LABELS[month - 1]} ${year}`
}

/**
 * Builds an array of month entries between two dates, inclusive.
 * Each entry has a month key, label, and amount initialized to 0.
 *
 * @param from - Start date
 * @param to - End date
 * @returns Array of month entries with `month`, `label`, and `amount` fields
 */
export function buildMonthRange(
  from: Date,
  to: Date,
): Array<{ month: string; label: string; amount: number }> {
  const result: Array<{ month: string; label: string; amount: number }> = []
  const current = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)

  while (current <= end) {
    const key = getMonthKey(current)
    result.push({ month: key, label: getMonthLabel(key), amount: 0 })
    current.setMonth(current.getMonth() + 1)
  }

  return result
}

/**
 * Fetches all Linear issues for a client's mapped projects and returns them as a Map.
 * Keys are issue IDs; values contain estimate and projectId.
 *
 * @param client - Client with Linear mappings to fetch issues for
 * @returns Map of issue ID to `{ estimate, projectId }`
 */
export async function fetchIssueMapForClient(
  client: Client & { linearMappings: LinearMapping[] },
): Promise<
  Map<string, { estimate: number | undefined; projectId: string | undefined }>
> {
  const issuePromises = client.linearMappings.map((mapping) =>
    fetchLinearIssues({
      teamId: mapping.linearTeamId ?? undefined,
      projectId: mapping.linearProjectId ?? undefined,
    }),
  )

  const issueResults = await Promise.allSettled(issuePromises)
  const allIssues = issueResults.flatMap((r) =>
    r.status === "fulfilled" ? r.value : [],
  )

  return new Map(
    allIssues.map((i) => [
      i.id,
      { estimate: i.estimate, projectId: i.projectId },
    ]),
  )
}

/**
 * Computes a date range based on a period preset or custom from/to parameters.
 * Supports "1m", "3m", "6m", "1y", and "custom" periods.
 *
 * @param period - Period preset string
 * @param fromParam - Custom start date string (used when period is "custom")
 * @param toParam - Custom end date string (used when period is "custom")
 * @returns Object with `from` and `to` Date instances
 */
export function computeDateRange(
  period: string,
  fromParam: string | null,
  toParam: string | null,
): { from: Date; to: Date } {
  const now = new Date()

  switch (period) {
    case "1m":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: now,
      }
    case "6m":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 5, 1),
        to: now,
      }
    case "1y":
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: now,
      }
    case "custom": {
      const from = fromParam
        ? new Date(fromParam)
        : new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const to = toParam ? new Date(toParam) : now

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return {
          from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
          to: now,
        }
      }

      return { from, to }
    }
    default:
      // 3m
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        to: now,
      }
  }
}

/**
 * Builds utilization data per month by comparing billed hours against available hours.
 *
 * @param monthRange - Array of month entries with `month` and `label`
 * @param monthHours - Map of month key to total billed hours
 * @param availableHoursPerMonth - Number of available working hours per month
 * @returns Array of utilization entries with billedHours, availableHours, and rate percentage
 */
export function buildUtilizationByMonth(
  monthRange: Array<{ month: string; label: string }>,
  monthHours: Map<string, number>,
  availableHoursPerMonth: number,
): UtilizationMonth[] {
  return monthRange.map(({ month, label }) => {
    const billedHours = Math.round((monthHours.get(month) ?? 0) * 100) / 100
    const rate =
      availableHoursPerMonth > 0
        ? Math.round((billedHours / availableHoursPerMonth) * 10000) / 100
        : 0
    return {
      month,
      label,
      billedHours,
      availableHours: availableHoursPerMonth,
      rate,
    }
  })
}

/**
 * Computes the total billing amount and hours for a group of task overrides.
 * Uses FIXED rate logic for fixed-billing clients; per-task calculation otherwise.
 *
 * @param overrides - Task overrides with their parent client
 * @param issueMap - Map of Linear issue ID to estimate data
 * @param client - The client record (for billing mode and rate)
 * @returns Object with total `amount` (rounded to 2 decimals) and total `hours`
 */
export function computeGroupAmount(
  overrides: OverrideWithClient[],
  issueMap: Map<string, { estimate: number | undefined }>,
  client: Client,
): { amount: number; hours: number } {
  const billingMode = client.billingMode as BillingMode
  const rate = Number(client.rate)

  let totalAmount = 0
  let totalHours = 0

  if (billingMode === "FIXED") {
    totalAmount = overrides.length > 0 ? rate : 0
  } else {
    for (const override of overrides) {
      const issue = issueMap.get(override.linearIssueId)
      const estimate = issue?.estimate
      const rateOverride = override.rateOverride
        ? Number(override.rateOverride)
        : null

      const billing = calculateBilling({
        billingMode,
        rate,
        estimate,
        rateOverride,
      })

      totalAmount += billing.amount

      if (estimate !== undefined) {
        totalHours += estimate
      }
    }
  }

  return {
    amount: Math.round(totalAmount * 100) / 100,
    hours: totalHours,
  }
}
