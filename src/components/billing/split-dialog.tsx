"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import { fmtEUR } from "@/lib/format"

type Schedule = "MONTHLY" | "WEEKLY" | "ONCE"

interface SplitDialogProps {
  total: number
  initialIssueDate: string
  initialDueDate: string
  isPending: boolean
  onClose: () => void
  onConfirm: (parts: number, schedule: Schedule) => void
}

/**
 * Modal that asks how many installments the invoice should be split into and
 * which cadence to use for the dueDate of each part.
 *
 * @param total preview-only base total (€) used to display per-part amount
 * @param onConfirm called with `(parts, schedule)` when the user validates
 */
export function SplitDialog({
  total,
  initialIssueDate,
  initialDueDate,
  isPending,
  onClose,
  onConfirm,
}: SplitDialogProps) {
  const [parts, setParts] = useState(2)
  const [schedule, setSchedule] = useState<Schedule>("MONTHLY")

  const partAmount = parts > 0 ? Math.round((total / parts) * 100) / 100 : 0

  return (
    <Modal
      title="Diviser la facture en plusieurs"
      onClose={onClose}
      width={560}
      footer={
        <>
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Annuler
          </button>
          <button
            className="btn btn-primary"
            disabled={isPending || parts < 2 || total <= 0}
            onClick={() => onConfirm(parts, schedule)}
          >
            <Icon name="check" size={14} />
            {isPending ? "Création…" : `Créer ${parts} factures`}
          </button>
        </>
      }
    >
      <div
        className="row gap-12"
        style={{ padding: 12, background: "var(--bg-2)", borderRadius: 8 }}
      >
        <div className="grow">
          <div className="muted xs">Total à diviser</div>
          <div className="num strong" style={{ fontSize: 22 }}>
            {fmtEUR(total)}
          </div>
        </div>
        <div>
          <div className="muted xs">Par facture</div>
          <div
            className="num strong"
            style={{ fontSize: 18, color: "var(--accent)" }}
          >
            {fmtEUR(partAmount)}
          </div>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Nombre de factures</label>
        <input
          className="input num"
          type="number"
          min={2}
          max={36}
          value={parts}
          onChange={(e) => setParts(Math.max(2, Number(e.target.value) || 2))}
        />
      </div>

      <div className="field">
        <label className="field-label">Cadence des échéances</label>
        <div
          className="row gap-4"
          style={{
            background: "var(--bg-2)",
            borderRadius: 7,
            padding: 3,
            border: "1px solid var(--border)",
          }}
        >
          {(
            [
              { id: "MONTHLY", label: "Mensuel" },
              { id: "WEEKLY", label: "Hebdo" },
              { id: "ONCE", label: "Même date" },
            ] as { id: Schedule; label: string }[]
          ).map((s) => (
            <button
              key={s.id}
              className="chip"
              style={{
                flex: 1,
                justifyContent: "center",
                background: schedule === s.id ? "var(--accent)" : "transparent",
                color:
                  schedule === s.id ? "var(--accent-text)" : "var(--text-1)",
                border: "none",
              }}
              onClick={() => setSchedule(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="muted xs" style={{ marginTop: 4 }}>
          Émission : {initialIssueDate} · 1ʳᵉ échéance : {initialDueDate}
        </div>
      </div>

      <div className="muted xs" style={{ fontStyle: "italic", marginTop: -4 }}>
        Numérotation : si le champ Numéro est rempli (ex. F-2026-0001), il sera
        incrémenté en F-2026-0002, F-2026-0003… Sinon, des numéros séquentiels
        seront générés automatiquement.
      </div>
    </Modal>
  )
}
