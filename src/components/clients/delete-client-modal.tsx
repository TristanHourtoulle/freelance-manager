"use client"

import { useTranslations } from "next-intl"
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
  const t = useTranslations("deleteClientModal")

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t("title")}
      description={t("description", { name: clientName })}
      confirmLabel={t("deleteButton")}
      variant="danger"
      isLoading={isDeleting}
    />
  )
}
