"use client"

import Link from "next/link"
import { useMemo } from "react"
import { Icon } from "@/components/ui/icon"
import { RelanceButton } from "@/components/dashboard/relance-button"
import { TaskIdLink } from "@/components/ui/task-id-link"
import {
  useActions,
  useUpdateAction,
  type ActionDTO,
} from "@/hooks/use-actions"
import { useMeetings, type MeetingDTO } from "@/hooks/use-meetings"
import { useDashboard } from "@/hooks/use-dashboard"
import { avatarColor, fmtEUR, fmtRelative, initials } from "@/lib/format"

const TOP_N = 3

function dayBounds(): { start: number; end: number } {
  const s = new Date()
  s.setHours(0, 0, 0, 0)
  const e = new Date()
  e.setHours(23, 59, 59, 999)
  return { start: s.getTime(), end: e.getTime() }
}

function clientLabel(c: {
  firstName: string
  lastName: string
  company: string | null
}) {
  return c.company || `${c.firstName} ${c.lastName}`
}

function ClientChip({ client }: { client: ActionDTO["client"] }) {
  if (!client) {
    return <span className="pill pill-no-dot pill-draft">Non classé</span>
  }
  return (
    <span className="suivi-client">
      <span
        className="avatar avatar-sm"
        style={{ background: client.color ?? avatarColor(clientLabel(client)) }}
      >
        {initials(clientLabel(client))}
      </span>
      {clientLabel(client)}
    </span>
  )
}

function SectionTitle({ label }: { label: string }) {
  return <div className="today-section-title">{label}</div>
}

function ActionsSection({
  actions,
  todayStart,
  hasMore,
  onToggle,
}: {
  actions: ActionDTO[]
  todayStart: number
  hasMore: boolean
  onToggle: (a: ActionDTO) => void
}) {
  return (
    <>
      <SectionTitle label="Actions dues" />
      <div className="suivi-list">
        {actions.map((a) => {
          const overdue =
            a.dueDate != null && new Date(a.dueDate).getTime() < todayStart
          return (
            <div key={a.id} className="suivi-item">
              <button
                type="button"
                className="suivi-check"
                onClick={() => onToggle(a)}
                aria-label="Marquer fait"
              />
              <div className="suivi-main">
                <div className="suivi-title">{a.title}</div>
                <div className="suivi-meta">
                  {a.dueDate && (
                    <span
                      className={overdue ? "suivi-due overdue" : "suivi-due"}
                    >
                      {fmtRelative(a.dueDate)}
                    </span>
                  )}
                  <ClientChip client={a.client} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {hasMore && (
        <Link href="/tasks" className="btn btn-ghost btn-sm">
          Voir tout
        </Link>
      )}
    </>
  )
}

function MeetingsSection({
  meetings,
  hasMore,
}: {
  meetings: MeetingDTO[]
  hasMore: boolean
}) {
  return (
    <>
      <SectionTitle label="Réunions" />
      <div className="suivi-list">
        {meetings.map((m) => (
          <div key={m.id} className="suivi-item suivi-meeting">
            <span className="suivi-meeting-open" style={{ cursor: "default" }}>
              <span className="suivi-meeting-icon">
                <Icon name="calendar" size={16} />
              </span>
              <span className="suivi-main">
                <span className="suivi-title">{m.title}</span>
                <span className="suivi-meta">
                  <span className="suivi-dim">Réunion</span>
                  <ClientChip client={m.client} />
                </span>
              </span>
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <Link href="/tasks" className="btn btn-ghost btn-sm">
          Voir tout
        </Link>
      )}
    </>
  )
}

/**
 * Always-visible "Aujourd'hui" dashboard panel.
 *
 * Aggregates today's follow-up actions, today's meetings, overdue invoices and
 * in-progress tasks. Totals come from the dashboard payload, never from the
 * 50-row paginated action and meeting lists.
 *
 * @returns The panel card, including an explicit empty state.
 */
export function TodayPanel() {
  const { data: actions = [] } = useActions({ status: "TODO" })
  const { data: meetings = [] } = useMeetings()
  const { data: dashboard } = useDashboard()
  const update = useUpdateAction()

  const { start, end } = useMemo(() => dayBounds(), [])

  const dueActions = useMemo(
    () =>
      actions
        .filter(
          (a) => a.dueDate != null && new Date(a.dueDate).getTime() <= end,
        )
        .sort((a, b) => {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : 0
          const db = b.dueDate ? new Date(b.dueDate).getTime() : 0
          return da - db
        }),
    [actions, end],
  )

  const todayMeetings = useMemo(
    () =>
      meetings.filter((m) => {
        const t = new Date(m.heldAt).getTime()
        return t >= start && t <= end
      }),
    [meetings, start, end],
  )

  const overdue = dashboard?.overdue ?? []
  const inProgress = dashboard?.inProgress
  const pipelineCount = dashboard?.kpi.pipelineCount ?? 0

  const isEmpty =
    dueActions.length === 0 &&
    todayMeetings.length === 0 &&
    overdue.length === 0 &&
    (inProgress?.top.length ?? 0) === 0

  function toggle(a: ActionDTO) {
    update.mutate({ id: a.id, input: { status: "DONE" } })
  }

  return (
    <div className="card">
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <Icon name="calendar" size={15} />
        <span style={{ fontWeight: 600 }}>Aujourd&apos;hui</span>
      </div>

      {isEmpty ? (
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
        <div className="today-sections">
          {dueActions.length > 0 && (
            <ActionsSection
              actions={dueActions.slice(0, TOP_N)}
              todayStart={start}
              hasMore={dueActions.length > TOP_N}
              onToggle={toggle}
            />
          )}

          {todayMeetings.length > 0 && (
            <MeetingsSection
              meetings={todayMeetings.slice(0, TOP_N)}
              hasMore={todayMeetings.length > TOP_N}
            />
          )}

          {overdue.length > 0 && (
            <>
              <SectionTitle label="Factures en retard" />
              <div className="suivi-list">
                {overdue.slice(0, TOP_N).map((o) => (
                  <div key={o.id} className="suivi-item">
                    <div className="suivi-main">
                      <div className="suivi-title mono">{o.number}</div>
                      <div className="suivi-meta">
                        <span className="num">{fmtEUR(o.total)}</span>
                        <span className="suivi-due overdue">
                          {fmtRelative(o.dueDate)}
                        </span>
                      </div>
                    </div>
                    <div className="suivi-item-actions">
                      <RelanceButton invoiceId={o.id} clientId={o.clientId} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {inProgress && inProgress.top.length > 0 && (
            <>
              <SectionTitle
                label={
                  inProgress.count > TOP_N
                    ? `En cours · ${inProgress.count}`
                    : "En cours"
                }
              />
              <div className="suivi-list">
                {inProgress.top.map((t) => (
                  <div key={t.id} className="suivi-item">
                    <div className="suivi-main">
                      <div className="suivi-title">{t.title}</div>
                      <div className="suivi-meta">
                        <TaskIdLink
                          identifier={t.linearIdentifier}
                          url={t.linearUrl}
                          className="task-id"
                        />
                        {t.projectKey && (
                          <span className="suivi-dim">{t.projectKey}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
