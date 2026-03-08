"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
 * Confirmation dialog built on the shadcn Dialog primitive.
 * Drop-in replacement for the old custom Modal. Used for destructive or important actions.
 *
 * @param isOpen - Controls visibility of the dialog
 * @param onClose - Callback invoked when the user dismisses the dialog
 * @param onConfirm - Callback invoked when the user clicks the confirm button
 * @param title - Heading displayed in the dialog
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
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) {
          onClose()
        }
      }}
    >
      <DialogContent showCloseButton={!isLoading}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : "default"}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
