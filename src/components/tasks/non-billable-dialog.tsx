"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import {
  NON_BILLABLE_REASON_LABELS,
  validateBillability,
} from "@/domain/tasks/billability"
import type { NonBillableReason } from "@/hooks/use-tasks"

const REASONS = Object.keys(NON_BILLABLE_REASON_LABELS) as NonBillableReason[]

interface NonBillableDialogProps {
  open: boolean
  taskCount: number
  onCancel: () => void
  onConfirm: (reason: NonBillableReason, note: string | null) => void
  isPending?: boolean
}

/**
 * Shared reason-picker dialog used by both the desktop and mobile Tasks pages
 * to exclude one or several tasks from invoicing.
 *
 * The OTHER reason requires a non-empty note, mirroring the domain invariant
 * enforced by `validateBillability`; the confirm button stays disabled and an
 * inline French error is shown until the note is filled.
 *
 * @param taskCount Number of tasks being marked, drives the singular/plural title.
 * @param onConfirm Called with the chosen reason and the trimmed note (or null).
 * @param isPending Disables the confirm button while the mutation runs.
 */
export function NonBillableDialog({
  open,
  taskCount,
  onCancel,
  onConfirm,
  isPending = false,
}: NonBillableDialogProps) {
  const [reason, setReason] = useState<NonBillableReason | null>(null)
  const [note, setNote] = useState("")
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen !== open) {
    setPrevOpen(open)
    setReason(null)
    setNote("")
  }

  if (!open) return null

  const trimmedNote = note.trim()
  const normalizedNote = trimmedNote === "" ? null : trimmedNote
  const isValid =
    reason !== null &&
    validateBillability({
      billable: false,
      nonBillableReason: reason,
      nonBillableNote: normalizedNote,
    }).ok
  const noteMissing = reason === "OTHER" && normalizedNote === null

  const title =
    taskCount > 1
      ? `Marquer ${taskCount} tâches comme non facturable`
      : `Marquer ${taskCount} tâche comme non facturable`

  function handleConfirm() {
    if (reason === null || !isValid) return
    onConfirm(reason, normalizedNote)
  }

  return (
    <Modal
      title={title}
      subtitle="La valeur de ces tâches sera exclue du pipeline de facturation."
      onClose={onCancel}
      width={460}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={!isValid || isPending}
          >
            {isPending ? "…" : "Confirmer"}
          </button>
        </>
      }
    >
      <div className="col gap-8" role="radiogroup" aria-label="Raison">
        {REASONS.map((r) => {
          const active = reason === r
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setReason(r)}
              className="row gap-8"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                border: active
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
                background: active ? "var(--accent-soft)" : "var(--bg-2)",
                color: "var(--text-0)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <span
                className={"checkbox-circle" + (active ? " checked" : "")}
                aria-hidden="true"
              >
                {active && <Icon name="check" size={13} />}
              </span>
              {NON_BILLABLE_REASON_LABELS[r]}
            </button>
          )
        })}
      </div>
      <div className="col gap-8" style={{ marginTop: 14 }}>
        <label className="xs muted" htmlFor="non-billable-note">
          Note{reason === "OTHER" ? " (obligatoire)" : " (optionnelle)"}
        </label>
        <textarea
          id="non-billable-note"
          className="input"
          rows={3}
          placeholder="Précise le contexte…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ resize: "vertical", minHeight: 64 }}
        />
        {noteMissing && (
          <div className="xs" style={{ color: "var(--danger)" }} role="alert">
            Une note est requise pour la raison « Autre ».
          </div>
        )}
      </div>
    </Modal>
  )
}
