"use client"

import { useId, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { useToast } from "@/components/providers/toast-provider"
import { useUpdateClient } from "@/hooks/use-clients"
import { Markdown } from "@/lib/markdown"

interface ClientNotesCardProps {
  clientId: string
  notes: string | null
  className?: string
  titleClassName?: string
}

/**
 * Client notes card with markdown rendering and an inline editor.
 *
 * @param clientId - Client whose `notes` field is edited.
 * @param notes - Current raw markdown notes, or null.
 * @param className - Card shell class, so desktop (`detail-card`) and mobile
 * (`card`) can reuse the same component.
 * @param titleClassName - Class of the card title element.
 */
export function ClientNotesCard({
  clientId,
  notes,
  className = "detail-card",
  titleClassName = "detail-card-title",
}: ClientNotesCardProps) {
  const fieldId = useId()
  const { toast } = useToast()
  const update = useUpdateClient(clientId)
  const [editing, setEditing] = useState(false)
  const [preview, setPreview] = useState(false)
  const [draft, setDraft] = useState(notes ?? "")

  function startEditing() {
    setDraft(notes ?? "")
    setPreview(false)
    setEditing(true)
  }

  function handleSave() {
    update.mutate(
      { notes: draft.trim() || null },
      {
        onSuccess: () => {
          toast({ variant: "success", title: "Notes enregistrées" })
          setEditing(false)
        },
        onError: (e) =>
          toast({ variant: "error", title: "Erreur", description: e.message }),
      },
    )
  }

  return (
    <div className={className}>
      <div className="detail-card-header">
        <div className={titleClassName}>Notes</div>
        {editing ? (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "4px 8px", fontSize: 12 }}
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? "Éditer" : "Aperçu"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "4px 8px", fontSize: 12 }}
            onClick={startEditing}
            aria-label="Modifier les notes"
          >
            <Icon name="edit" size={12} />
          </button>
        )}
      </div>

      {editing ? (
        <>
          {preview ? (
            <div className="suivi-md-preview">
              {draft.trim() ? (
                <Markdown source={draft} />
              ) : (
                <span style={{ color: "var(--text-3)" }}>Rien à afficher.</span>
              )}
            </div>
          ) : (
            <textarea
              id={`${fieldId}-notes`}
              className="textarea mono"
              rows={8}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={"## Contexte\n- …"}
            />
          )}
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditing(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={update.isPending}
              onClick={handleSave}
            >
              {update.isPending ? "…" : "Enregistrer"}
            </button>
          </div>
        </>
      ) : notes ? (
        <Markdown source={notes} className="suivi-md-preview" />
      ) : (
        <div className="muted small">Aucune note pour ce client.</div>
      )}
    </div>
  )
}
