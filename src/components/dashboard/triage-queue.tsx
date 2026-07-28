"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Icon, type IconName } from "@/components/ui/icon"
import { RelanceButton } from "@/components/dashboard/relance-button"
import { useActions, useUpdateAction } from "@/hooks/use-actions"
import { useMeetings } from "@/hooks/use-meetings"
import {
  buildTriageItems,
  type TriageItem,
  type TriageOverdueInvoice,
  type TriagePipelineAging,
} from "@/domain/dashboard/triage"

const TODO_ONLY = { statuses: ["TODO"] } as const

const KIND_ICON: Record<TriageItem["kind"], IconName> = {
  overdue: "alert",
  stalePipeline: "alert",
  unestimated: "info",
  action: "check-square",
  meeting: "calendar",
}

interface TriageQueueProps {
  overdue: TriageOverdueInvoice[]
  pipelineAging: TriagePipelineAging
  unestimatedCount: number
  pipelineCount: number
}

function TriageRowAction({
  item,
  onDone,
  donePending,
}: {
  item: TriageItem
  onDone: (actionId: string) => void
  donePending: boolean
}) {
  switch (item.kind) {
    case "overdue":
      return (
        <RelanceButton invoiceId={item.invoiceId} clientId={item.clientId} />
      )
    case "stalePipeline":
      return (
        <Link href="/billing/new" className="btn btn-sm btn-primary">
          Facturer
        </Link>
      )
    case "unestimated":
      return (
        <Link href="/tasks" className="btn btn-sm btn-secondary">
          Estimer
        </Link>
      )
    case "action":
      return (
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => onDone(item.actionId)}
          disabled={donePending}
        >
          Fait
        </button>
      )
    case "meeting":
      return null
  }
}

/**
 * Severity-ordered triage queue shown in hero position on both dashboards.
 *
 * Merges everything actionable into one list: overdue invoices (danger),
 * stale pipeline (warn), unestimated tasks (info), then today's due Suivi
 * actions and today's meetings. Dashboard-derived rows arrive as props;
 * actions and meetings are fetched here the way the former today panel did.
 *
 * @param overdue - Overdue invoices from the dashboard payload.
 * @param pipelineAging - Pipeline age profile from the dashboard payload.
 * @param unestimatedCount - Billable tasks with no estimate.
 * @param pipelineCount - Total billable tasks, used by the empty state.
 * @returns The queue card, including an explicit empty state.
 */
export function TriageQueue({
  overdue,
  pipelineAging,
  unestimatedCount,
  pipelineCount,
}: TriageQueueProps) {
  const { data: actions = [] } = useActions(TODO_ONLY)
  const { data: meetings = [] } = useMeetings()
  const update = useUpdateAction()

  const items = useMemo(
    () =>
      buildTriageItems({
        now: new Date(),
        overdue,
        pipelineAging,
        unestimatedCount,
        actions,
        meetings,
      }),
    [overdue, pipelineAging, unestimatedCount, actions, meetings],
  )

  function markDone(actionId: string) {
    update.mutate({ id: actionId, input: { status: "DONE" } })
  }

  return (
    <div className="card">
      <div className="row gap-8" style={{ marginBottom: 12 }}>
        <span style={{ fontWeight: 600 }}>À traiter aujourd&apos;hui</span>
        <span className="pill pill-no-dot pill-draft num">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Rien pour aujourd&apos;hui</div>
          <div className="empty-sub">
            {pipelineCount > 0
              ? `${pipelineCount} task${pipelineCount > 1 ? "s" : ""} en attente de facturation`
              : "Tout est à jour."}
          </div>
          {pipelineCount > 0 && (
            <Link
              href="/billing/new"
              className="btn btn-sm btn-primary"
              style={{ marginTop: 10 }}
            >
              Facturer
            </Link>
          )}
        </div>
      ) : (
        <div className="triage-list">
          {items.map((item) => (
            <div key={item.id} className={`triage-row triage-${item.severity}`}>
              <Icon
                name={KIND_ICON[item.kind]}
                size={16}
                className="triage-ic"
              />
              <div className="triage-main">
                <div className="triage-title">{item.title}</div>
                <div className="triage-detail">{item.detail}</div>
              </div>
              <div className="triage-action">
                <TriageRowAction
                  item={item}
                  onDone={markDone}
                  donePending={update.isPending}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
