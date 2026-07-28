"use client"

import { Icon } from "@/components/ui/icon"
import { fmtEUR } from "@/lib/format"

interface TaskSelectionBarProps {
  selectedCount: number
  selectedValue: number
  hiddenSelectedCount: number
  canInvoiceSelected: boolean
  selectionAllNonBillable: boolean
  billabilityPending: boolean
  onClear: () => void
  onMarkNonBillable: () => void
  onRestoreBillable: () => void
  onCreateInvoice: () => void
}

/**
 * Floating bar shown while tasks are selected on the desktop Tasks page:
 * count, pipeline total, deselect, billability toggle and invoice creation.
 *
 * @param selectionAllNonBillable Swaps the billability action to "Marquer
 *   facturable" when every selected task is already non-billable.
 * @param onMarkNonBillable Opens the shared non-billable reason dialog.
 */
export function TaskSelectionBar({
  selectedCount,
  selectedValue,
  hiddenSelectedCount,
  canInvoiceSelected,
  selectionAllNonBillable,
  billabilityPending,
  onClear,
  onMarkNonBillable,
  onRestoreBillable,
  onCreateInvoice,
}: TaskSelectionBarProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "var(--bg-1)",
        border: "1px solid var(--border-strong)",
        borderRadius: 12,
        padding: "10px 16px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        zIndex: 20,
      }}
    >
      <span className="strong small">
        {selectedCount} task{selectedCount > 1 ? "s" : ""} sélectionnée
        {selectedCount > 1 ? "s" : ""}
      </span>
      <span className="muted xs">·</span>
      <span className="num strong">{fmtEUR(selectedValue)}</span>
      {hiddenSelectedCount > 0 && (
        <span
          className="pill pill-no-dot xs pill-draft"
          title="Sélections masquées par les filtres actuels"
        >
          {hiddenSelectedCount} hors filtre
        </span>
      )}
      <button className="btn btn-ghost btn-sm" onClick={onClear}>
        <Icon name="x" size={12} /> Désélectionner
      </button>
      {selectionAllNonBillable ? (
        <button
          className="btn btn-secondary btn-sm"
          onClick={onRestoreBillable}
          disabled={billabilityPending}
        >
          <Icon name="eye" size={12} />
          Marquer facturable
        </button>
      ) : (
        <button
          className="btn btn-secondary btn-sm"
          onClick={onMarkNonBillable}
          disabled={billabilityPending}
        >
          <Icon name="eye-off" size={12} />
          Marquer non facturable
        </button>
      )}
      {canInvoiceSelected && (
        <button className="btn btn-primary btn-sm" onClick={onCreateInvoice}>
          <Icon name="invoice" size={12} />
          Créer facture
        </button>
      )}
    </div>
  )
}
