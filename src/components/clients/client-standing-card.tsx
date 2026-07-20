"use client"

import { fmtDate, fmtRelative } from "@/lib/format"
import type { ClientDetailDTO } from "@/hooks/use-client-detail"

const MS_PER_DAY = 24 * 60 * 60 * 1000
const SUMMARY_EXCERPT_LENGTH = 180
const MAX_OPEN_ACTIONS = 5

/**
 * Whole days elapsed since the last recorded contact.
 *
 * @param lastContactAt - ISO timestamp of the most recent meeting or completed action, or null.
 * @param now - Reference date, injected so the result is deterministic in tests.
 * @returns The day count, or null when there has never been a contact.
 */
export function daysSinceLastContact(
  lastContactAt: string | null,
  now: Date,
): number | null {
  if (!lastContactAt) return null
  const elapsed = now.getTime() - new Date(lastContactAt).getTime()
  if (Number.isNaN(elapsed)) return null
  return Math.max(0, Math.floor(elapsed / MS_PER_DAY))
}

/**
 * Plain-text excerpt of a markdown summary, stripped of block syntax.
 *
 * @param source - Raw markdown, or null.
 * @returns A single-line excerpt truncated with an ellipsis, or an empty string.
 */
export function summaryExcerpt(source: string | null): string {
  if (!source) return ""
  const flat = source
    .replace(/[#>*_`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (flat.length <= SUMMARY_EXCERPT_LENGTH) return flat
  return `${flat.slice(0, SUMMARY_EXCERPT_LENGTH).trimEnd()}…`
}

interface ClientStandingCardProps {
  lastContactAt: string | null
  meetings: ClientDetailDTO["meetings"]
  openActions: ClientDetailDTO["openActions"]
}

/**
 * "Où on en est" overview card: last meeting, open follow-up actions and how
 * long it has been since the last recorded contact with this client.
 *
 * @param lastContactAt - ISO timestamp of the latest meeting or completed action.
 * @param meetings - The client's most recent meetings, newest first.
 * @param openActions - Follow-up actions still `TODO` or `WAITING`.
 */
export function ClientStandingCard({
  lastContactAt,
  meetings,
  openActions,
}: ClientStandingCardProps) {
  const days = daysSinceLastContact(lastContactAt, new Date())
  const lastMeeting = meetings[0]
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const visibleActions = openActions.slice(0, MAX_OPEN_ACTIONS)
  const isEmpty = meetings.length === 0 && openActions.length === 0

  return (
    <div className="detail-card">
      <div className="detail-card-header">
        <div>
          <div className="detail-card-title">Où on en est</div>
          <div className="detail-card-sub">
            {days == null
              ? "Aucun contact enregistré"
              : days === 0
                ? "Dernier contact aujourd'hui"
                : `Dernier contact il y a ${days} jour${days > 1 ? "s" : ""}`}
          </div>
        </div>
      </div>

      {isEmpty ? (
        <div className="muted small">
          Aucun suivi enregistré pour ce client.
        </div>
      ) : (
        <>
          {lastMeeting && (
            <div style={{ marginBottom: visibleActions.length > 0 ? 14 : 0 }}>
              <div className="suivi-title">{lastMeeting.title}</div>
              <div className="suivi-meta">
                <span>{fmtDate(lastMeeting.heldAt)}</span>
                {lastMeeting.participants.length > 0 && (
                  <span className="suivi-dim">
                    {lastMeeting.participants.length} participant
                    {lastMeeting.participants.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {summaryExcerpt(lastMeeting.summaryMd) && (
                <div
                  className="muted small"
                  style={{ marginTop: 6, lineHeight: 1.6 }}
                >
                  {summaryExcerpt(lastMeeting.summaryMd)}
                </div>
              )}
            </div>
          )}

          {visibleActions.length > 0 && (
            <div className="suivi-list">
              {visibleActions.map((a) => {
                const waiting = a.status === "WAITING"
                const due = a.dueDate ? new Date(a.dueDate).getTime() : null
                const overdue =
                  !waiting && due != null && due < todayStart.getTime()
                return (
                  <div key={a.id} className="suivi-item">
                    <div className="suivi-main">
                      <div className="suivi-title">{a.title}</div>
                      <div className="suivi-meta">
                        {waiting && (
                          <span className="pill pill-no-dot pill-waiting">
                            En attente
                          </span>
                        )}
                        {a.dueDate && (
                          <span
                            className={
                              overdue ? "suivi-due overdue" : "suivi-due"
                            }
                          >
                            {fmtRelative(a.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
