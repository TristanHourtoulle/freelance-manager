"use client"

import { useTranslations } from "next-intl"
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
  const t = useTranslations("archiveModal")

  const title = isArchived ? t("unarchiveTitle") : t("archiveTitle")
  const description = isArchived
    ? t("unarchiveDesc", { name: clientName })
    : t("archiveDesc", { name: clientName })

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={isArchived ? t("unarchiveButton") : t("archiveButton")}
      variant="default"
      isLoading={isLoading}
    />
  )
}
