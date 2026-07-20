"use client"

import { useMemo } from "react"
import { Icon } from "@/components/ui/icon"
import {
  useActions,
  useUpdateAction,
  type ActionDTO,
} from "@/hooks/use-actions"
import { useMeetings } from "@/hooks/use-meetings"
import { avatarColor, fmtRelative, initials } from "@/lib/format"

const TODO_ONLY = { statuses: ["TODO"] } as const

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

/**
 * Compact dashboard widget: follow-up actions due today (or overdue) with a
 * one-tap "done" toggle, plus today's meetings. Renders nothing when there is
 * nothing for today so the dashboard stays clean.
 */
export function TodayBlock() {
  const { data: actions = [] } = useActions(TODO_ONLY)
  const { data: meetings = [] } = useMeetings()
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

  if (dueActions.length === 0 && todayMeetings.length === 0) return null

  function toggle(a: ActionDTO) {
    update.mutate({ id: a.id, input: { status: "DONE" } })
  }

  return (
    <div className="card">
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <Icon name="calendar" size={15} />
        <span style={{ fontWeight: 600 }}>Aujourd&apos;hui</span>
      </div>

      <div className="suivi-list">
        {dueActions.map((a) => {
          const overdue =
            a.dueDate != null && new Date(a.dueDate).getTime() < start
          return (
            <div key={a.id} className="suivi-item">
              <button
                type="button"
                className="suivi-check"
                onClick={() => toggle(a)}
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
                  <span className="suivi-client">
                    <span
                      className="avatar avatar-sm"
                      style={{
                        background:
                          a.client.color ?? avatarColor(clientLabel(a.client)),
                      }}
                    >
                      {initials(clientLabel(a.client))}
                    </span>
                    {clientLabel(a.client)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {todayMeetings.map((m) => (
          <div key={m.id} className="suivi-item suivi-meeting">
            <span className="suivi-meeting-open" style={{ cursor: "default" }}>
              <span className="suivi-meeting-icon">
                <Icon name="calendar" size={16} />
              </span>
              <span className="suivi-main">
                <span className="suivi-title">{m.title}</span>
                <span className="suivi-meta">
                  <span className="suivi-dim">Réunion</span>
                  <span className="suivi-client">
                    <span
                      className="avatar avatar-sm"
                      style={{
                        background:
                          m.client.color ?? avatarColor(clientLabel(m.client)),
                      }}
                    >
                      {initials(clientLabel(m.client))}
                    </span>
                    {clientLabel(m.client)}
                  </span>
                </span>
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
