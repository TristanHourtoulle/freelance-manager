"use client"

import { Modal } from "@/components/ui/modal"

interface DeleteClientModalProps {
  clientName: string
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting: boolean
}

export function DeleteClientModal({
  clientName,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}: DeleteClientModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete client"
      description={`Are you sure you want to delete "${clientName}"? This action cannot be undone. All associated data (mappings, overrides, invoices) will be permanently removed.`}
      confirmLabel="Delete"
      variant="danger"
      isLoading={isDeleting}
    />
  )
}
