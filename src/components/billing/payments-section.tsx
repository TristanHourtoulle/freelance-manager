"use client"

import { useState } from "react"
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

interface PaymentsSectionProps {
  invoiceId: string
  total: number
  balanceDue: number
  paidAmount: number
  payments?: InvoicePaymentDTO[]
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERPAID"
  documentStatus: "DRAFT" | "SENT" | "CANCELLED"
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export function PaymentsSection({
  invoiceId,
  total,
  balanceDue,
  paidAmount,
  payments: paymentsProp,
  paymentStatus,
  documentStatus,
}: PaymentsSectionProps) {
  const payments = paymentsProp ?? []
  const create = useCreatePayment(invoiceId)
  const update = useUpdatePayment(invoiceId)
  const del = useDeletePayment(invoiceId)
  const { toast } = useToast()

  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [amount, setAmount] = useState<number>(0)
  const [paidAt, setPaidAt] = useState<string>(todayISO())
  const [method, setMethod] = useState<string>("")
  const [note, setNote] = useState<string>("")

  function startAdd() {
    setEditingId(null)
    setAmount(Math.max(0, balanceDue))
    setPaidAt(todayISO())
    setMethod("")
    setNote("")
    setAdding(true)
  }

  function startEdit(p: InvoicePaymentDTO) {
    setAdding(false)
    setEditingId(p.id)
    setAmount(p.amount)
    setPaidAt(p.paidAt.slice(0, 10))
    setMethod(p.method ?? "")
    setNote(p.note ?? "")
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
    const payload = {
      amount,
      paidAt,
      method: method.trim() || null,
      note: note.trim() || null,
    }
    if (editingId) {
      update.mutate(
        { paymentId: editingId, ...payload },
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
      create.mutate(payload, {
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
      })
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
  const isOverpaying = amount > balanceDue + (editingId ? 0 : 0)
  const canAdd =
    documentStatus !== "CANCELLED" && (paymentStatus !== "PAID" || true)

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
              <label className="field-label">Montant (€)</label>
              <input
                className="input num"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="field" style={{ width: 160 }}>
              <label className="field-label">Date</label>
              <input
                className="input"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 140 }}>
              <label className="field-label">Méthode (optionnel)</label>
              <input
                className="input"
                placeholder="Virement, CB, Espèces…"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label className="field-label">Note (optionnel)</label>
            <input
              className="input"
              placeholder="Référence, remarque…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
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
              disabled={create.isPending || update.isPending || amount <= 0}
            >
              <Icon name="check" size={12} />
              {editingId ? "Mettre à jour" : "Enregistrer"}
            </button>
          </div>
          {void isOverpaying}
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
