"use client"

import { useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

type ModalVariant = "default" | "danger"

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  variant?: ModalVariant
  isLoading?: boolean
}

/**
 * Confirmation dialog rendered as a centered overlay.
 * Closes on Escape key or backdrop click. Used for destructive or important actions.
 *
 * @param isOpen - Controls visibility of the modal
 * @param onClose - Callback invoked when the user dismisses the modal
 * @param onConfirm - Callback invoked when the user clicks the confirm button
 * @param title - Heading displayed in the modal
 * @param description - Explanatory text below the title
 * @param confirmLabel - Label for the confirm button (defaults to "Confirm")
 * @param variant - "default" or "danger"; controls confirm button styling
 * @param isLoading - Disables interactions and shows a loading state on confirm
 */
export function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "default",
  isLoading = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose()
      }
    },
    [onClose, isLoading],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current && !isLoading) {
      onClose()
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg">
        <h2>{title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
