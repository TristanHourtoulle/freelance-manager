"use client"

import { StatusPill } from "@/components/ui/pill"
import { TaskIdLink } from "@/components/ui/task-id-link"
import { fmtRelative } from "@/lib/format"
import type { DashboardDTO } from "@/hooks/use-dashboard"

const RECENT_DONE_MAX = 5

type InProgress = DashboardDTO["inProgress"]
type RecentTask = DashboardDTO["recentTasks"][number]

function taskPillStatus(status: RecentTask["status"]) {
  if (status === "PENDING_INVOICE") return "pending_invoice" as const
  if (status === "DONE") return "done" as const
  if (status === "IN_PROGRESS") return "in_progress" as const
  return "backlog" as const
}

/**
 * « En cours » rail card: the in-progress count plus the top tasks.
 *
 * Shared by the desktop and mobile dashboards so both twins stay identical.
 *
 * @param inProgress - The in-progress slice of the dashboard payload.
 */
export function InProgressCard({ inProgress }: { inProgress: InProgress }) {
  return (
    <div className="card">
      <div className="row gap-8" style={{ marginBottom: 12 }}>
        <span style={{ fontWeight: 600 }}>En cours</span>
        <span className="pill pill-no-dot pill-draft num">
          {inProgress.count}
        </span>
      </div>
      {inProgress.top.length === 0 ? (
        <div className="muted small">Aucune task en cours</div>
      ) : (
        <div className="col gap-8">
          {inProgress.top.map((t) => (
            <div key={t.id} className="row gap-12" style={{ padding: "4px 0" }}>
              <TaskIdLink
                identifier={t.linearIdentifier}
                url={t.linearUrl}
                className="task-id task-id-live"
              />
              <div className="grow truncate small">{t.title}</div>
              <span className="xs" style={{ color: "var(--text-3)" }}>
                {t.projectKey ?? ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * « Terminées récemment » rail card listing the latest completed tasks.
 *
 * Shared by the desktop and mobile dashboards so both twins stay identical.
 *
 * @param tasks - Recent tasks from the dashboard payload; capped at five rows.
 */
export function RecentDoneCard({ tasks }: { tasks: RecentTask[] }) {
  return (
    <div className="card">
      <div className="row gap-8" style={{ marginBottom: 12 }}>
        <span style={{ fontWeight: 600 }}>Terminées récemment</span>
      </div>
      {tasks.length === 0 ? (
        <div className="muted small">Aucune task terminée</div>
      ) : (
        <div className="col gap-8">
          {tasks.slice(0, RECENT_DONE_MAX).map((t) => (
            <div key={t.id} className="row gap-12" style={{ padding: "4px 0" }}>
              <TaskIdLink
                identifier={t.linearIdentifier}
                url={t.linearUrl}
                className="task-id"
              />
              <div className="grow truncate small muted">{t.title}</div>
              <StatusPill status={taskPillStatus(t.status)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Faint one-line footer stating when Linear was last synced.
 *
 * @param lastSync - ISO timestamp of the last sync, or null when unknown.
 */
export function LastSyncLine({ lastSync }: { lastSync: string | null }) {
  return (
    <div className="xs muted" style={{ padding: "0 2px" }}>
      Dernière sync Linear · {lastSync ? fmtRelative(lastSync) : "—"}
    </div>
  )
}
