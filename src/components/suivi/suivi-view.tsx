"use client"

import { useMemo, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { useToast } from "@/components/providers/toast-provider"
import {
  useActions,
  useUpdateAction,
  type ActionDTO,
  type ClientActionType,
} from "@/hooks/use-actions"
import { useMeetings, type MeetingDTO } from "@/hooks/use-meetings"
import { ActionModal } from "@/components/suivi/action-modal"
import { MeetingModal } from "@/components/suivi/meeting-modal"
import { avatarColor, fmtDate, fmtRelative, initials } from "@/lib/format"

type SubTab = "actions" | "meetings"
type ActionFilter = "today" | "upcoming" | "all" | "done"

const ACTION_PILL: Record<ClientActionType, { label: string; cls: string }> = {
  RELANCE: { label: "Relance", cls: "pill-partial" },
  LINK: { label: "Lien", cls: "pill-sent" },
  RDV: { label: "RDV", cls: "pill-fixed" },
  OTHER: { label: "Autre", cls: "pill-draft" },
}

function dayBounds(): { start: number; end: number } {
  const s = new Date()
  s.setHours(0, 0, 0, 0)
  const e = new Date()
  e.setHours(23, 59, 59, 999)
  return { start: s.getTime(), end: e.getTime() }
}

function fmtDuration(min: number): string {
  if (!min) return ""
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h} h ${m}`
  if (h) return `${h} h`
  return `${m} min`
}

function clientLabel(c: {
  firstName: string
  lastName: string
  company: string | null
}) {
  return c.company || `${c.firstName} ${c.lastName}`
}

type ActionModalState =
  | { mode: "closed" }
  | { mode: "create"; defaultType?: ClientActionType }
  | { mode: "edit"; action: ActionDTO }

type MeetingModalState =
  | { mode: "closed" }
  | {
      mode: "create"
      defaultTitle?: string
      onCreated?: (m: MeetingDTO) => void
    }
  | { mode: "edit"; meeting: MeetingDTO }

interface SuiviViewProps {
  clientId?: string
}

/**
 * Reusable "Suivi" surface: client follow-up actions and Teams meeting logs.
 * Renders all clients when `clientId` is omitted, or a single client's items
 * when provided. Used on the Tasks page (Suivi mode) and the client detail tab.
 */
export function SuiviView({ clientId }: SuiviViewProps) {
  const { toast } = useToast()
  const [sub, setSub] = useState<SubTab>("actions")
  const [filter, setFilter] = useState<ActionFilter>("today")
  const [actionModal, setActionModal] = useState<ActionModalState>({
    mode: "closed",
  })
  const [meetingModal, setMeetingModal] = useState<MeetingModalState>({
    mode: "closed",
  })

  const status = filter === "done" ? "DONE" : "TODO"
  const actionsQuery = useActions({ clientId, status })
  const meetingsQuery = useMeetings({ clientId })
  const updateAction = useUpdateAction(clientId)

  const actions = useMemo(() => actionsQuery.data ?? [], [actionsQuery.data])
  const meetings = meetingsQuery.data ?? []

  const visibleActions = useMemo(() => {
    if (filter === "done") return actions
    const { end } = dayBounds()
    const inBucket = (a: ActionDTO) => {
      if (filter === "all") return true
      const due = a.dueDate ? new Date(a.dueDate).getTime() : null
      if (filter === "today") return due != null && due <= end
      return due != null && due > end
    }
    return actions
      .filter(inBucket)
      .slice()
      .sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
        return da - db
      })
  }, [actions, filter])

  function toggleDone(a: ActionDTO) {
    updateAction.mutate({
      id: a.id,
      input: { status: a.status === "DONE" ? "TODO" : "DONE" },
    })
  }

  function markHeld(a: ActionDTO) {
    setMeetingModal({
      mode: "create",
      defaultTitle: a.title,
      onCreated: (m) =>
        updateAction.mutate({
          id: a.id,
          input: { status: "DONE", meetingId: m.id },
        }),
    })
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      toast({ variant: "success", title: "Lien copié" })
    } catch {
      toast({ variant: "error", title: "Copie impossible" })
    }
  }

  const { start: todayStart } = dayBounds()

  return (
    <div className="suivi">
      <div className="suivi-head">
        <div className="seg" style={{ maxWidth: 240 }}>
          <button
            type="button"
            className={sub === "actions" ? "active" : ""}
            onClick={() => setSub("actions")}
          >
            Actions
          </button>
          <button
            type="button"
            className={sub === "meetings" ? "active" : ""}
            onClick={() => setSub("meetings")}
          >
            Réunions
          </button>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() =>
            sub === "actions"
              ? setActionModal({ mode: "create" })
              : setMeetingModal({ mode: "create" })
          }
        >
          <Icon name="plus" size={13} />
          {sub === "actions" ? "Nouvelle action" : "Nouvelle réunion"}
        </button>
      </div>

      {sub === "actions" ? (
        <>
          <div className="chip-row" style={{ marginBottom: 14 }}>
            {(
              [
                { id: "today", label: "Aujourd'hui" },
                { id: "upcoming", label: "À venir" },
                { id: "all", label: "Tout" },
                { id: "done", label: "Fait" },
              ] as { id: ActionFilter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={"chip" + (filter === f.id ? " active" : "")}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {visibleActions.length === 0 ? (
            <div className="empty">
              <div className="empty-title">Rien ici</div>
              <div className="empty-sub">
                {filter === "done"
                  ? "Aucune action terminée."
                  : "Aucune action à faire."}
              </div>
            </div>
          ) : (
            <div className="suivi-list">
              {visibleActions.map((a) => {
                const done = a.status === "DONE"
                const due = a.dueDate ? new Date(a.dueDate).getTime() : null
                const overdue = !done && due != null && due < todayStart
                const pill = ACTION_PILL[a.type]
                return (
                  <div
                    key={a.id}
                    className={"suivi-item" + (done ? " done" : "")}
                  >
                    <button
                      type="button"
                      className={"suivi-check" + (done ? " on" : "")}
                      onClick={() => toggleDone(a)}
                      aria-label={done ? "Marquer à faire" : "Marquer fait"}
                    >
                      {done && <Icon name="check" size={13} />}
                    </button>
                    <div className="suivi-main">
                      <div className="suivi-title">{a.title}</div>
                      <div className="suivi-meta">
                        <span className={`pill pill-no-dot ${pill.cls}`}>
                          {pill.label}
                        </span>
                        {a.dueDate && (
                          <span
                            className={
                              overdue ? "suivi-due overdue" : "suivi-due"
                            }
                          >
                            {fmtRelative(a.dueDate)}
                          </span>
                        )}
                        {a.invoiceNumber && (
                          <span className="mono suivi-dim">
                            {a.invoiceNumber}
                          </span>
                        )}
                        {!clientId && (
                          <span className="suivi-client">
                            <span
                              className="avatar avatar-sm"
                              style={{
                                background:
                                  a.client.color ??
                                  avatarColor(clientLabel(a.client)),
                              }}
                            >
                              {initials(clientLabel(a.client))}
                            </span>
                            {clientLabel(a.client)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="suivi-item-actions">
                      {a.type === "LINK" && a.link && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => copyLink(a.link as string)}
                          aria-label="Copier le lien"
                        >
                          <Icon name="copy" size={15} />
                        </button>
                      )}
                      {a.type === "RDV" && !a.meetingId && !done && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => markHeld(a)}
                        >
                          Marquer tenue
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() =>
                          setActionModal({ mode: "edit", action: a })
                        }
                        aria-label="Modifier"
                      >
                        <Icon name="edit" size={15} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : meetings.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Aucune réunion</div>
          <div className="empty-sub">
            Consigne une réunion Teams : lien, participants, durée et résumé.
          </div>
        </div>
      ) : (
        <div className="suivi-list">
          {meetings.map((m) => (
            <div key={m.id} className="suivi-item suivi-meeting">
              <button
                type="button"
                className="suivi-meeting-open"
                onClick={() => setMeetingModal({ mode: "edit", meeting: m })}
              >
                <span className="suivi-meeting-icon">
                  <Icon name="calendar" size={16} />
                </span>
                <span className="suivi-main">
                  <span className="suivi-title">{m.title}</span>
                  <span className="suivi-meta">
                    <span>{fmtDate(m.heldAt)}</span>
                    {m.durationMinutes > 0 && (
                      <span className="suivi-dim">
                        {fmtDuration(m.durationMinutes)}
                      </span>
                    )}
                    {m.participants.length > 0 && (
                      <span className="suivi-dim">
                        {m.participants.length} participant
                        {m.participants.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {!clientId && (
                      <span className="suivi-client">
                        <span
                          className="avatar avatar-sm"
                          style={{
                            background:
                              m.client.color ??
                              avatarColor(clientLabel(m.client)),
                          }}
                        >
                          {initials(clientLabel(m.client))}
                        </span>
                        {clientLabel(m.client)}
                      </span>
                    )}
                  </span>
                </span>
              </button>
              {m.teamsUrl && (
                <a
                  href={m.teamsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  Teams
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {actionModal.mode !== "closed" && (
        <ActionModal
          clientId={clientId}
          action={actionModal.mode === "edit" ? actionModal.action : null}
          defaultType={
            actionModal.mode === "create" ? actionModal.defaultType : undefined
          }
          onClose={() => setActionModal({ mode: "closed" })}
        />
      )}
      {meetingModal.mode !== "closed" && (
        <MeetingModal
          clientId={clientId}
          meeting={meetingModal.mode === "edit" ? meetingModal.meeting : null}
          defaultTitle={
            meetingModal.mode === "create"
              ? meetingModal.defaultTitle
              : undefined
          }
          onCreated={
            meetingModal.mode === "create" ? meetingModal.onCreated : undefined
          }
          onClose={() => setMeetingModal({ mode: "closed" })}
        />
      )}
    </div>
  )
}
