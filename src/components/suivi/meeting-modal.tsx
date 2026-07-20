"use client"

import { useId, useMemo, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/providers/toast-provider"
import { useClients } from "@/hooks/use-clients"
import {
  useCreateMeeting,
  useDeleteMeeting,
  useUpdateMeeting,
  type MeetingDTO,
} from "@/hooks/use-meetings"
import { useActions } from "@/hooks/use-actions"
import { useMeetings } from "@/hooks/use-meetings"
import { ActionModal } from "@/components/suivi/action-modal"
import { Markdown } from "@/lib/markdown"
import { fmtRelative } from "@/lib/format"

function todayInput(): string {
  return new Date().toISOString().slice(0, 10)
}

interface MeetingModalProps {
  clientId?: string
  meeting?: MeetingDTO | null
  defaultTitle?: string
  onCreated?: (meeting: MeetingDTO) => void
  onClose: () => void
}

/**
 * Create or edit a Teams meeting record: link, participants, real duration
 * and a markdown summary with a live preview toggle. `onCreated` lets callers
 * (e.g. an RDV action being marked held) react to the new meeting.
 */
export function MeetingModal({
  clientId,
  meeting,
  defaultTitle,
  onCreated,
  onClose,
}: MeetingModalProps) {
  const fieldId = useId()
  const { toast } = useToast()
  const isEdit = Boolean(meeting)
  const { data: clients } = useClients()

  const create = useCreateMeeting()
  const effectiveClientId = clientId ?? meeting?.clientId
  const update = useUpdateMeeting(effectiveClientId)
  const remove = useDeleteMeeting(effectiveClientId)

  const [selectedClient, setSelectedClient] = useState(
    meeting?.clientId ?? clientId ?? "",
  )
  const [title, setTitle] = useState(meeting?.title ?? defaultTitle ?? "")
  const [teamsUrl, setTeamsUrl] = useState(meeting?.teamsUrl ?? "")
  const [heldAt, setHeldAt] = useState(
    (meeting?.heldAt ?? "").slice(0, 10) || todayInput(),
  )
  const [duration, setDuration] = useState(
    meeting ? String(meeting.durationMinutes) : "",
  )
  const [participants, setParticipants] = useState(
    (meeting?.participants ?? []).join(", "),
  )
  const [agendaMd, setAgendaMd] = useState(meeting?.agendaMd ?? "")
  const [agendaPreview, setAgendaPreview] = useState(false)
  const [summaryMd, setSummaryMd] = useState(meeting?.summaryMd ?? "")
  const [preview, setPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newAction, setNewAction] = useState(false)

  const targetClientId = clientId ?? meeting?.clientId ?? selectedClient
  const isValid = title.trim().length > 0 && targetClientId.length > 0
  const isPending = create.isPending || update.isPending

  const { data: clientMeetings } = useMeetings(
    targetClientId ? { clientId: targetClientId } : undefined,
  )
  const { data: clientActions } = useActions(
    meeting ? { clientId: meeting.clientId } : undefined,
  )

  const participantSuggestions = useMemo(
    () =>
      [...new Set((clientMeetings ?? []).flatMap((m) => m.participants))].sort(
        (a, b) => a.localeCompare(b, "fr"),
      ),
    [clientMeetings],
  )

  const meetingActions = useMemo(
    () =>
      meeting
        ? (clientActions ?? []).filter((a) => a.meetingId === meeting.id)
        : [],
    [clientActions, meeting],
  )

  function buildPayload() {
    return {
      title: title.trim(),
      teamsUrl: teamsUrl.trim() || null,
      heldAt,
      durationMinutes: duration ? Number(duration) : 0,
      participants: participants
        .split(/[,\n]/)
        .map((p) => p.trim())
        .filter(Boolean),
      agendaMd: agendaMd.trim() || null,
      summaryMd: summaryMd.trim() || null,
    }
  }

  function handleSubmit() {
    if (!isValid) return
    if (isEdit && meeting) {
      update.mutate(
        { id: meeting.id, input: buildPayload() },
        {
          onSuccess: () => {
            toast({ variant: "success", title: "Réunion mise à jour" })
            onClose()
          },
          onError: (e) =>
            toast({
              variant: "error",
              title: "Erreur",
              description: e.message,
            }),
        },
      )
    } else {
      create.mutate(
        { clientId: targetClientId, ...buildPayload() },
        {
          onSuccess: (m) => {
            toast({ variant: "success", title: "Réunion consignée" })
            onCreated?.(m)
            onClose()
          },
          onError: (e) =>
            toast({
              variant: "error",
              title: "Erreur",
              description: e.message,
            }),
        },
      )
    }
  }

  function handleDelete() {
    if (!meeting) return
    remove.mutate(meeting.id, {
      onSuccess: () => {
        toast({ variant: "success", title: "Réunion supprimée" })
        onClose()
      },
      onError: (e) =>
        toast({ variant: "error", title: "Erreur", description: e.message }),
    })
  }

  return (
    <>
      <Modal
        title={isEdit ? "Réunion" : "Nouvelle réunion"}
        onClose={onClose}
        footer={
          <>
            {isEdit && (
              <button
                type="button"
                className="btn btn-danger"
                style={{ marginRight: "auto" }}
                onClick={() => setConfirmDelete(true)}
              >
                Supprimer
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!isValid || isPending}
              onClick={handleSubmit}
            >
              {isPending ? "…" : isEdit ? "Enregistrer" : "Consigner"}
            </button>
          </>
        }
      >
        <div className="modal-section">
          {!clientId && !isEdit && (
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label" htmlFor={`${fieldId}-client`}>
                Client
              </label>
              <select
                id={`${fieldId}-client`}
                className="select"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
              >
                <option value="">Sélectionner…</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company || `${c.firstName} ${c.lastName}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label" htmlFor={`${fieldId}-titre`}>
              Titre
            </label>
            <input
              id={`${fieldId}-titre`}
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Point hebdo, kickoff…"
              autoFocus
            />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label" htmlFor={`${fieldId}-lien-teams`}>
              Lien Teams
            </label>
            <input
              id={`${fieldId}-lien-teams`}
              className="input"
              value={teamsUrl}
              onChange={(e) => setTeamsUrl(e.target.value)}
              placeholder="https://teams.microsoft.com/…"
            />
          </div>

          <div className="field-grid-2">
            <div className="field">
              <label className="field-label" htmlFor={`${fieldId}-date`}>
                Date
              </label>
              <input
                id={`${fieldId}-date`}
                className="input"
                type="date"
                value={heldAt}
                onChange={(e) => setHeldAt(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${fieldId}-duree`}>
                Durée
              </label>
              <div className="input-suffix-wrap">
                <input
                  id={`${fieldId}-duree`}
                  className="input num"
                  type="number"
                  min={0}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="0"
                />
                <span className="suffix">min</span>
              </div>
            </div>
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label className="field-label" htmlFor={`${fieldId}-participants`}>
              Participants
            </label>
            <input
              id={`${fieldId}-participants`}
              className="input"
              list={`${fieldId}-participants-list`}
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
              placeholder="Séparés par des virgules"
            />
            <datalist id={`${fieldId}-participants-list`}>
              {participantSuggestions.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="modal-section">
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: 8 }}
          >
            <label className="field-label" htmlFor={`${fieldId}-agenda-md`}>
              Ordre du jour (markdown)
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setAgendaPreview((p) => !p)}
            >
              {agendaPreview ? "Éditer" : "Aperçu"}
            </button>
          </div>
          {agendaPreview ? (
            <div className="suivi-md-preview">
              {agendaMd.trim() ? (
                <Markdown source={agendaMd} />
              ) : (
                <span style={{ color: "var(--text-3)" }}>Rien à afficher.</span>
              )}
            </div>
          ) : (
            <textarea
              id={`${fieldId}-agenda-md`}
              className="textarea mono"
              rows={6}
              value={agendaMd}
              onChange={(e) => setAgendaMd(e.target.value)}
              placeholder={"## À aborder\n- …"}
            />
          )}
        </div>

        <div className="modal-section">
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: 8 }}
          >
            <label className="field-label" htmlFor={`${fieldId}-summary-md`}>
              Résumé (markdown)
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? "Éditer" : "Aperçu"}
            </button>
          </div>
          {preview ? (
            <div className="suivi-md-preview">
              {summaryMd.trim() ? (
                <Markdown source={summaryMd} />
              ) : (
                <span style={{ color: "var(--text-3)" }}>Rien à afficher.</span>
              )}
            </div>
          ) : (
            <textarea
              id={`${fieldId}-summary-md`}
              className="textarea mono"
              rows={8}
              value={summaryMd}
              onChange={(e) => setSummaryMd(e.target.value)}
              placeholder={"## Points clés\n- …"}
            />
          )}
        </div>

        {isEdit && meeting && (
          <div className="modal-section">
            <div className="modal-section-title">
              Actions issues de cette réunion
            </div>
            {meetingActions.length === 0 ? (
              <div className="muted small">
                Aucune action issue de cette réunion.
              </div>
            ) : (
              <div className="suivi-list">
                {meetingActions.map((a) => (
                  <div key={a.id} className="suivi-item">
                    <div className="suivi-main">
                      <div className="suivi-title">{a.title}</div>
                      <div className="suivi-meta">
                        {a.status === "WAITING" && (
                          <span className="pill pill-no-dot pill-waiting">
                            En attente
                          </span>
                        )}
                        {a.status === "DONE" && (
                          <span className="pill pill-no-dot pill-done">
                            Fait
                          </span>
                        )}
                        {a.dueDate && (
                          <span className="suivi-due">
                            {fmtRelative(a.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: 10 }}
              onClick={() => setNewAction(true)}
            >
              Créer une action depuis cette réunion
            </button>
          </div>
        )}
      </Modal>

      {newAction && meeting && (
        <ActionModal
          clientId={meeting.clientId}
          defaultMeetingId={meeting.id}
          onClose={() => setNewAction(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Supprimer cette réunion ?"
          description="La réunion et son résumé seront supprimés."
          confirmLabel="Supprimer"
          danger
          isPending={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}
