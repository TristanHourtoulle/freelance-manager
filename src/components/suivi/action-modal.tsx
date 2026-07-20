"use client"

import { useId, useState } from "react"
import { Modal } from "@/components/ui/modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/providers/toast-provider"
import { useClients } from "@/hooks/use-clients"
import { useInvoices } from "@/hooks/use-invoices"
import {
  useCreateAction,
  useDeleteAction,
  useUpdateAction,
  type ActionDTO,
  type ClientActionType,
} from "@/hooks/use-actions"
import { fmtEUR } from "@/lib/format"

const TYPE_OPTIONS: { id: ClientActionType; label: string }[] = [
  { id: "RELANCE", label: "Relance" },
  { id: "LINK", label: "Lien" },
  { id: "RDV", label: "RDV" },
  { id: "OTHER", label: "Autre" },
]

interface ActionModalProps {
  clientId?: string
  action?: ActionDTO | null
  defaultType?: ClientActionType
  onClose: () => void
}

/**
 * Create or edit a client follow-up action. When `clientId` is omitted the
 * user picks a client; type-specific fields surface a link (LINK) or an
 * invoice picker (RELANCE).
 */
export function ActionModal({
  clientId,
  action,
  defaultType,
  onClose,
}: ActionModalProps) {
  const fieldId = useId()
  const { toast } = useToast()
  const isEdit = Boolean(action)
  const { data: clients } = useClients()
  const { data: invoices } = useInvoices()

  const create = useCreateAction()
  const effectiveClientId = clientId ?? action?.clientId
  const update = useUpdateAction(effectiveClientId)
  const remove = useDeleteAction(effectiveClientId)

  const [selectedClient, setSelectedClient] = useState(
    action?.clientId ?? clientId ?? "",
  )
  const [type, setType] = useState<ClientActionType>(
    action?.type ?? defaultType ?? "OTHER",
  )
  const [title, setTitle] = useState(action?.title ?? "")
  const [dueDate, setDueDate] = useState((action?.dueDate ?? "").slice(0, 10))
  const [link, setLink] = useState(action?.link ?? "")
  const [invoiceId, setInvoiceId] = useState(action?.invoiceId ?? "")
  const [notes, setNotes] = useState(action?.notes ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const targetClientId = selectedClient || (clientId ?? "")
  const clientInvoices = (invoices ?? []).filter(
    (inv) => inv.clientId === targetClientId,
  )
  const isValid = title.trim().length > 0
  const isPending = create.isPending || update.isPending

  function handleSubmit() {
    if (!isValid) return
    const payload = {
      type,
      title: title.trim(),
      dueDate: dueDate || null,
      link: type === "LINK" ? link.trim() || null : null,
      invoiceId: type === "RELANCE" ? invoiceId || null : null,
      notes: notes.trim() || null,
    }
    if (isEdit && action) {
      update.mutate(
        {
          id: action.id,
          input: {
            ...payload,
            ...(clientId ? {} : { clientId: targetClientId || null }),
          },
        },
        {
          onSuccess: () => {
            toast({ variant: "success", title: "Action mise à jour" })
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
        { clientId: targetClientId || null, ...payload },
        {
          onSuccess: () => {
            toast({ variant: "success", title: "Action créée" })
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
    if (!action) return
    remove.mutate(action.id, {
      onSuccess: () => {
        toast({ variant: "success", title: "Action supprimée" })
        onClose()
      },
      onError: (e) =>
        toast({ variant: "error", title: "Erreur", description: e.message }),
    })
  }

  return (
    <>
      <Modal
        title={isEdit ? "Modifier l'action" : "Nouvelle action"}
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
              {isPending ? "…" : isEdit ? "Enregistrer" : "Créer"}
            </button>
          </>
        }
      >
        <div className="modal-section">
          <div className="modal-section-title">Type</div>
          <div className="seg">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={type === t.id ? "active" : ""}
                onClick={() => setType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-section">
          {!clientId && (
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
                <option value="">Non classé</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company || `${c.firstName} ${c.lastName}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field" style={{ marginBottom: 12 }}>
            <label className="field-label" htmlFor={`${fieldId}-intitule`}>
              Intitulé
            </label>
            <input
              id={`${fieldId}-intitule`}
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Relancer la facture 2026-1027…"
              autoFocus
            />
          </div>

          <div className="field-grid-2">
            <div className="field">
              <label className="field-label" htmlFor={`${fieldId}-echeance`}>
                Échéance
              </label>
              <input
                id={`${fieldId}-echeance`}
                className="input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            {type === "RELANCE" && targetClientId && (
              <div className="field">
                <label
                  className="field-label"
                  htmlFor={`${fieldId}-facture-liee`}
                >
                  Facture liée
                </label>
                <select
                  id={`${fieldId}-facture-liee`}
                  className="select"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                >
                  <option value="">Aucune</option>
                  {clientInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.number} · {fmtEUR(inv.total)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {type === "LINK" && (
            <div className="field" style={{ marginTop: 12 }}>
              <label className="field-label" htmlFor={`${fieldId}-lien`}>
                Lien
              </label>
              <input
                id={`${fieldId}-lien`}
                className="input"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…"
              />
            </div>
          )}
        </div>

        <div className="modal-section">
          <div className="field">
            <label className="field-label" htmlFor={`${fieldId}-notes`}>
              Notes
            </label>
            <textarea
              id={`${fieldId}-notes`}
              className="textarea"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {confirmDelete && (
        <ConfirmDialog
          title="Supprimer cette action ?"
          description="Cette action sera définitivement supprimée."
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
