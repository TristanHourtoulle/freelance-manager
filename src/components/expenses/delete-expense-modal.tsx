"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface DeleteExpenseModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  description: string
  isDeleting: boolean
}

export function DeleteExpenseModal({
  open,
  onClose,
  onConfirm,
  description,
  isDeleting,
}: DeleteExpenseModalProps) {
  const t = useTranslations("expenses")

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>
            {t("deleteDescription", { description })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2.5 pt-2">
          <Button
            variant="outline"
            shape="pill-left"
            size="lg"
            onClick={onClose}
          >
            {t("form.cancel")}
          </Button>
          <Button
            variant="destructive"
            shape="pill-right"
            size="lg"
            isLoading={isDeleting}
            onClick={onConfirm}
          >
            {t("deleteButton")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
