import { fetchLinearIssues } from "@/lib/linear-service"
import { calculateBilling } from "@/lib/billing"

import type {
  BillingMode,
  TaskOverride,
  Client,
  LinearMapping,
} from "@/generated/prisma/client"

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

export function getMonthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

export function getMonthLabel(key: string): string {
  const month = parseInt(key.split("-")[1]!, 10)
  return MONTH_LABELS[month - 1]!
}

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

export async function fetchIssueMapForClient(
  client: Client & { linearMappings: LinearMapping[] },
): Promise<Map<string, { estimate: number | undefined }>> {
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

  return new Map(allIssues.map((i) => [i.id, { estimate: i.estimate }]))
}

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
