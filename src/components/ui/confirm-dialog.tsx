"use client"

import { Modal } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import type { IconName } from "@/components/ui/icon"

interface ConfirmDialogProps {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  isPending?: boolean
  icon?: IconName
  onCancel: () => void
  onConfirm: () => void
}

/**
 * Styled yes/no confirmation modal. Use this instead of `window.confirm`
 * everywhere, including destructive actions (`danger=true` paints the
 * primary action red).
 *
 * @param onConfirm Called when the user clicks the primary action.
 * @param onCancel Called on backdrop click, Escape, or Cancel button.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  danger = false,
  isPending = false,
  icon,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      width={460}
      footer={
        <>
          <button
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isPending}
          >
            {cancelLabel}
          </button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
            disabled={isPending}
          >
            {icon && <Icon name={icon} size={14} />}
            {isPending ? "…" : confirmLabel}
          </button>
        </>
      }
    >
      {description && (
        <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>
          {description}
        </p>
      )}
    </Modal>
  )
}
