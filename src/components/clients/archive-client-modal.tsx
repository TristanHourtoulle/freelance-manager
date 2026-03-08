"use client"

import { Modal } from "@/components/ui/modal"

interface ArchiveClientModalProps {
  clientName: string
  isArchived: boolean
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
}

/** Confirmation modal for archiving or unarchiving a client. Used on the clients page. */
export function ArchiveClientModal({
  clientName,
  isArchived,
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}: ArchiveClientModalProps) {
  const title = isArchived ? "Unarchive client" : "Archive client"
  const description = isArchived
    ? `Are you sure you want to unarchive "${clientName}"? The client will return to your active list.`
    : `Are you sure you want to archive "${clientName}"? The client will be hidden from the active list but all data (mappings, invoices) will be preserved. You can unarchive at any time.`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={isArchived ? "Unarchive" : "Archive"}
      variant="default"
      isLoading={isLoading}
    />
  )
}
