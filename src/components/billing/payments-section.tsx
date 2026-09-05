"use client"

import { useId, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { fmtDate, fmtEUR, fmtEURprecise } from "@/lib/format"
import {
  useCreatePayment,
  useDeletePayment,
  useUpdatePayment,
  type InvoicePaymentDTO,
} from "@/hooks/use-invoices"
import { useToast } from "@/components/providers/toast-provider"
import { isPenaltyWithinAmount } from "@/lib/schemas/payment"

interface PaymentsSectionProps {
  invoiceId: string
  total: number
  balanceDue: number
  paidAmount: number
  payments?: InvoicePaymentDTO[]
  documentStatus: "DRAFT" | "SENT" | "CANCELLED"
  lateFeeDue?: number
  penaltyPaid?: number
}

const todayISO = () => new Date().toISOString().slice(0, 10)

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function PaymentsSection({
  invoiceId,
  total,
  balanceDue,
  paidAmount,
  payments: paymentsProp,
  documentStatus,
  lateFeeDue = 0,
  penaltyPaid = 0,
}: PaymentsSectionProps) {
  const fieldId = useId()
  const payments = paymentsProp ?? []
  const create = useCreatePayment(invoiceId)
  const update = useUpdatePayment(invoiceId)
  const del = useDeletePayment(invoiceId)
  const { toast } = useToast()

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [amount, setAmount] = useState<number>(0)
  const [paidAt, setPaidAt] = useState<string>(() => todayISO())
  const [method, setMethod] = useState<string>("")
  const [note, setNote] = useState<string>("")
  const [penaltyAmount, setPenaltyAmount] = useState<number>(0)
  const [editingPenaltyAmount, setEditingPenaltyAmount] = useState<number>(0)

  const penaltyOutstanding = round2(Math.max(0, lateFeeDue - penaltyPaid))

  function startAdd() {
    setEditingId(null)
    setAmount(Math.max(0, balanceDue))
    setPaidAt(todayISO())
    setMethod("")
    setNote("")
    setPenaltyAmount(0)
    setAdding(true)
  }

  function startEdit(p: InvoicePaymentDTO) {
    setAdding(false)
    setEditingId(p.id)
    setAmount(p.amount)
    setPaidAt(p.paidAt.slice(0, 10))
    setMethod(p.method ?? "")
    setNote(p.note ?? "")
    setPenaltyAmount(0)
    setEditingPenaltyAmount(p.penaltyAmount)
  }

  function cancel() {
    setAdding(false)
    setEditingId(null)
  }

  function submit() {
    if (amount <= 0) {
      toast({
        variant: "error",
        title: "Montant requis",
        description: "Le montant doit être supérieur à 0.",
      })
      return
    }
    if (
      !editingId &&
      penaltyAmount > 0 &&
      !isPenaltyWithinAmount({ amount, penaltyAmount })
    ) {
      toast({
        variant: "error",
        title: "Montant de pénalité invalide",
        description: "La pénalité ne peut pas dépasser le montant du paiement.",
      })
      return
    }
    if (
      editingId &&
      !isPenaltyWithinAmount({
        amount,
        penaltyAmount: editingPenaltyAmount,
      })
    ) {
      toast({
        variant: "error",
        title: "Montant de pénalité invalide",
        description: "La pénalité ne peut pas dépasser le montant du paiement.",
      })
      return
    }
    if (editingId) {
      update.mutate(
        {
          paymentId: editingId,
          amount,
          paidAt,
          method: method.trim() || null,
          note: note.trim() || null,
        },
        {
          onSuccess: () => {
            toast({ variant: "success", title: "Paiement mis à jour" })
            cancel()
          },
          onError: (e) =>
            toast({
              variant: "error",
              title: "Erreur",
              description: e instanceof Error ? e.message : String(e),
            }),
        },
      )
    } else {
      create.mutate(
        {
          amount,
          paidAt,
          method: method.trim() || null,
          note: note.trim() || null,
          penaltyAmount,
        },
        {
          onSuccess: () => {
            toast({ variant: "success", title: "Paiement enregistré" })
            cancel()
          },
          onError: (e) =>
            toast({
              variant: "error",
              title: "Erreur",
              description: e instanceof Error ? e.message : String(e),
            }),
        },
      )
    }
  }

  function handleDelete() {
    if (!confirmDeleteId) return
    del.mutate(confirmDeleteId, {
      onSuccess: () => {
        toast({ variant: "success", title: "Paiement supprimé" })
        setConfirmDeleteId(null)
      },
      onError: (e) =>
        toast({
          variant: "error",
          title: "Erreur",
          description: e instanceof Error ? e.message : String(e),
        }),
    })
  }

  const formOpen = adding || editingId != null
  const canAdd = documentStatus !== "CANCELLED"

  return (
    <div className="col gap-12">
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div className="col" style={{ gap: 2 }}>
          <span className="strong">Paiements</span>
          <span className="muted xs">
            {payments.length} versement{payments.length > 1 ? "s" : ""} ·{" "}
            {fmtEUR(paidAmount)} reçu sur {fmtEUR(total)}
          </span>
        </div>
        {!formOpen && canAdd && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={startAdd}
            disabled={create.isPending}
          >
            <Icon name="plus" size={12} />
            Enregistrer un paiement
          </button>
        )}
      </div>

      {balanceDue > 0 && payments.length > 0 && (
        <div
          className="row gap-8"
          style={{
            padding: "8px 12px",
            background: "var(--warn-soft)",
            color: "var(--warn)",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <Icon name="alert" size={12} />
          Reste à recevoir{" "}
          <span className="num strong">{fmtEURprecise(balanceDue)}</span>
          {penaltyOutstanding > 0 && (
            <span className="xs">
              (dont{" "}
              <span className="num">{fmtEURprecise(penaltyOutstanding)}</span>{" "}
              de pénalité)
            </span>
          )}
        </div>
      )}
      {balanceDue < 0 && (
        <div
          className="row gap-8"
          style={{
            padding: "8px 12px",
            background: "var(--purple-soft)",
            color: "var(--purple)",
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <Icon name="info" size={12} />
          Trop-perçu de{" "}
          <span className="num strong">{fmtEURprecise(-balanceDue)}</span>
          {penaltyPaid > 0 && (
            <span className="xs">
              (dont <span className="num">{fmtEURprecise(penaltyPaid)}</span>{" "}
              de pénalité réglée)
            </span>
          )}
        </div>
      )}

      {payments.length > 0 && (
        <div
          className="col"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {payments.map((p, idx) => (
            <div
              key={p.id}
              className="row gap-12"
              style={{
                padding: "10px 12px",
                borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                background: editingId === p.id ? "var(--bg-2)" : "transparent",
              }}
            >
              <Icon
                name="check"
                size={14}
                style={{ color: "var(--accent)", flexShrink: 0 }}
              />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row gap-8">
                  <span className="num strong">{fmtEURprecise(p.amount)}</span>
                  <span className="muted xs">· {fmtDate(p.paidAt)}</span>
                  {p.method && <span className="muted xs">· {p.method}</span>}
                </div>
                {p.note && (
                  <div className="muted xs truncate" style={{ marginTop: 2 }}>
                    {p.note}
                  </div>
                )}
                {p.penaltyAmount > 0 && (
                  <div className="muted xs" style={{ marginTop: 2 }}>
                    dont {fmtEUR(p.penaltyAmount)} de pénalité
                  </div>
                )}
              </div>
              {documentStatus !== "CANCELLED" && (
                <>
                  <button
                    className="icon-btn"
                    onClick={() => startEdit(p)}
                    title="Modifier"
                  >
                    <Icon name="edit" size={12} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setConfirmDeleteId(p.id)}
                    title="Supprimer"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div
          className="col gap-10"
          style={{
            padding: 12,
            background: "var(--bg-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          <div className="row gap-8" style={{ flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1, minWidth: 130 }}>
              <label className="field-label" htmlFor={`${fieldId}-montant`}>
                Montant (€)
              </label>
              <input
                id={`${fieldId}-montant`}
                className="input num"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="field" style={{ width: 160 }}>
              <label className="field-label" htmlFor={`${fieldId}-date`}>
                Date
              </label>
              <input
                id={`${fieldId}-date`}
                className="input"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label
                className="field-label"
                htmlFor={`${fieldId}-methode-optionnel`}
              >
                Méthode (optionnel)
              </label>
              <input
                id={`${fieldId}-methode-optionnel`}
                className="input"
                placeholder="Virement, CB, Espèces…"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label
              className="field-label"
              htmlFor={`${fieldId}-note-optionnel`}
            >
              Note (optionnel)
            </label>
            <input
              id={`${fieldId}-note-optionnel`}
              className="input"
              placeholder="Référence, remarque…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {!editingId && penaltyOutstanding > 0 && (
            <div className="field">
              <label
                className="field-label"
                htmlFor={`${fieldId}-penalite-optionnel`}
              >
                Dont pénalité de retard (optionnel)
              </label>
              <input
                id={`${fieldId}-penalite-optionnel`}
                className="input num"
                type="number"
                step="0.01"
                min="0"
                max={Math.min(penaltyOutstanding, amount)}
                placeholder={fmtEUR(0)}
                value={penaltyAmount}
                onChange={(e) => setPenaltyAmount(Number(e.target.value))}
              />
              <div className="muted xs" style={{ marginTop: 4 }}>
                Pénalité réclamée restant due :{" "}
                <span className="num">{fmtEURprecise(penaltyOutstanding)}</span>
              </div>
            </div>
          )}
          {editingId != null &&
            editingPenaltyAmount > 0 &&
            amount < editingPenaltyAmount && (
              <div className="xs" style={{ color: "var(--danger)" }}>
                Ce paiement couvre {fmtEURprecise(editingPenaltyAmount)} de
                pénalité : le montant ne peut pas descendre en dessous.
              </div>
            )}
          {!editingId && balanceDue > 0 && amount === balanceDue && (
            <div className="muted xs">
              Va solder la facture (paiement total).
            </div>
          )}
          {!editingId && balanceDue > 0 && amount > balanceDue && (
            <div className="xs" style={{ color: "var(--purple)" }}>
              {fmtEURprecise(amount - balanceDue)} en trop-perçu.
            </div>
          )}
          {!editingId &&
            balanceDue > 0 &&
            amount > 0 &&
            amount < balanceDue && (
              <div className="muted xs">
                Restera{" "}
                <span className="num strong">
                  {fmtEURprecise(balanceDue - amount)}
                </span>{" "}
                à recevoir.
              </div>
            )}
          {!editingId && balanceDue <= 0 && amount > 0 && (
            <div className="xs" style={{ color: "var(--purple)" }}>
              Va augmenter le trop-perçu de {fmtEURprecise(amount)}.
            </div>
          )}
          <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-ghost btn-sm" onClick={cancel}>
              Annuler
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={submit}
              disabled={
                create.isPending ||
                update.isPending ||
                amount <= 0 ||
                (editingId != null && amount < editingPenaltyAmount)
              }
            >
              <Icon name="check" size={12} />
              {editingId ? "Mettre à jour" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title="Supprimer ce paiement ?"
          description="Le statut de paiement de la facture sera recalculé."
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
          danger
          icon="trash"
          isPending={del.isPending}
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
