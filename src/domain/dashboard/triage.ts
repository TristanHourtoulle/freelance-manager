import { fmtEUR } from "@/lib/format"

export const TRIAGE_TOP_N = 3

const DAY_MS = 86_400_000

export interface TriageOverdueInvoice {
  id: string
  number: string
  clientId: string
  total: number
  dueDate: string
}

export interface TriagePipelineAging {
  oldestDays: number | null
  staleCount: number
  staleValue: number
}

export interface TriageActionRow {
  id: string
  title: string
  status: string
  dueDate: string | null
}

export interface TriageMeetingRow {
  id: string
  title: string
  heldAt: string
}

export type TriageSeverity = "danger" | "warn" | "info" | "plain"

interface TriageItemBase {
  id: string
  title: string
  detail: string
}

export type TriageItem =
  | (TriageItemBase & {
      kind: "overdue"
      severity: "danger"
      invoiceId: string
      clientId: string
    })
  | (TriageItemBase & { kind: "stalePipeline"; severity: "warn" })
  | (TriageItemBase & { kind: "unestimated"; severity: "info" })
  | (TriageItemBase & { kind: "action"; severity: "plain"; actionId: string })
  | (TriageItemBase & { kind: "meeting"; severity: "plain" })

export interface TriageInput {
  now: Date
  overdue: readonly TriageOverdueInvoice[]
  pipelineAging: TriagePipelineAging
  unestimatedCount: number
  actions: readonly TriageActionRow[]
  meetings: readonly TriageMeetingRow[]
}

function dayBounds(now: Date): { start: number; end: number } {
  const s = new Date(now)
  s.setHours(0, 0, 0, 0)
  const e = new Date(now)
  e.setHours(23, 59, 59, 999)
  return { start: s.getTime(), end: e.getTime() }
}

function daysLate(now: Date, dueDate: string): number {
  const raw = Math.floor((now.getTime() - new Date(dueDate).getTime()) / DAY_MS)
  return raw < 0 ? 0 : raw
}

function meetingTime(heldAt: string): string {
  return new Date(heldAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Count the pipeline tasks that actually carry an estimate.
 *
 * `pipelineCount` includes unestimated tasks that contribute 0 € to
 * `pipelineEur`, so displaying it next to the pipeline value overstates what
 * the euros cover. This is the honest count shown by the money strip.
 *
 * @param pipelineCount - Total billable tasks in the pipeline.
 * @param unestimatedCount - Billable tasks with no estimate.
 * @returns The estimated-task count, never negative.
 */
export function countEstimatedPipelineTasks(
  pipelineCount: number,
  unestimatedCount: number,
): number {
  const diff = pipelineCount - unestimatedCount
  return diff > 0 ? diff : 0
}

/**
 * Build the severity-ordered triage queue shown in hero position.
 *
 * Order is fixed: overdue invoices (danger), stale pipeline (warn),
 * unestimated tasks (info), then today's due actions and today's meetings
 * (plain). Actions keep TODO rows whose due date is on or before the end of
 * today; meetings keep rows held today. Both plain groups are sorted by date
 * and capped at {@link TRIAGE_TOP_N}.
 *
 * @param input - Reference instant plus the raw dashboard, action and meeting rows.
 * @returns The ordered triage items with their display strings prebuilt.
 */
export function buildTriageItems(input: TriageInput): TriageItem[] {
  const { now, overdue, pipelineAging, unestimatedCount, actions, meetings } =
    input
  const { start, end } = dayBounds(now)
  const items: TriageItem[] = []

  for (const inv of overdue) {
    items.push({
      kind: "overdue",
      severity: "danger",
      id: `overdue-${inv.id}`,
      title: inv.number,
      detail: `Échue il y a ${daysLate(now, inv.dueDate)} j · ${fmtEUR(inv.total)}`,
      invoiceId: inv.id,
      clientId: inv.clientId,
    })
  }

  if (pipelineAging.staleCount > 0) {
    const plural = pipelineAging.staleCount > 1 ? "s" : ""
    items.push({
      kind: "stalePipeline",
      severity: "warn",
      id: "stale-pipeline",
      title: "Pipeline vieillissante",
      detail: `La plus ancienne attend ${pipelineAging.oldestDays ?? 0} j · ${pipelineAging.staleCount} task${plural} > 30 j · ${fmtEUR(pipelineAging.staleValue)}`,
    })
  }

  if (unestimatedCount > 0) {
    const plural = unestimatedCount > 1 ? "s" : ""
    items.push({
      kind: "unestimated",
      severity: "info",
      id: "unestimated",
      title: `${unestimatedCount} tâche${plural} à estimer`,
      detail: "Valeur pipeline inconnue tant qu'elles ne sont pas estimées",
    })
  }

  const dueActions = actions
    .filter(
      (a) =>
        a.status === "TODO" &&
        a.dueDate != null &&
        new Date(a.dueDate).getTime() <= end,
    )
    .sort(
      (a, b) =>
        new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime(),
    )
    .slice(0, TRIAGE_TOP_N)
  for (const action of dueActions) {
    items.push({
      kind: "action",
      severity: "plain",
      id: `action-${action.id}`,
      title: action.title,
      detail: "Action due aujourd'hui",
      actionId: action.id,
    })
  }

  const todayMeetings = meetings
    .filter((m) => {
      const t = new Date(m.heldAt).getTime()
      return t >= start && t <= end
    })
    .sort((a, b) => new Date(a.heldAt).getTime() - new Date(b.heldAt).getTime())
    .slice(0, TRIAGE_TOP_N)
  for (const meeting of todayMeetings) {
    items.push({
      kind: "meeting",
      severity: "plain",
      id: `meeting-${meeting.id}`,
      title: meeting.title,
      detail: `Réunion aujourd'hui · ${meetingTime(meeting.heldAt)}`,
    })
  }

  return items
}
