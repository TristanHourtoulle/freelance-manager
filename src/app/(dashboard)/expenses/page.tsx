"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { PlusIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ExpenseSummary } from "@/components/expenses/expense-summary"
import { ExpenseList } from "@/components/expenses/expense-list"
import { ExpenseFilters } from "@/components/expenses/expense-filters"
import { ExpenseForm } from "@/components/expenses/expense-form"
import { DeleteExpenseModal } from "@/components/expenses/delete-expense-modal"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { useToast } from "@/components/providers/toast-provider"
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from "@/hooks/use-expenses"
import { useClients } from "@/hooks/use-clients"

import type { SerializedExpense } from "@/hooks/use-expenses"
import type { CreateExpenseInput } from "@/lib/schemas/expense"

export default function ExpensesPage() {
  const t = useTranslations("expenses")
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SerializedExpense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SerializedExpense | null>(
    null,
  )

  const { data, isLoading } = useExpenses(searchParams.toString())
  const { data: clientsData } = useClients("")
  const createMutation = useCreateExpense()
  const updateMutation = useUpdateExpense()
  const deleteMutation = useDeleteExpense()

  const expenses = data?.items ?? []
  const clients = (clientsData?.items ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }))

  const handleCreate = useCallback(
    async (formData: CreateExpenseInput) => {
      try {
        await createMutation.mutateAsync(formData)
        toast({ variant: "success", title: t("toasts.created") })
        setFormOpen(false)
      } catch {
        toast({ variant: "error", title: t("toasts.createError") })
      }
    },
    [createMutation, toast, t],
  )

  const handleUpdate = useCallback(
    async (formData: CreateExpenseInput) => {
      if (!editTarget) return
      try {
        await updateMutation.mutateAsync({ id: editTarget.id, data: formData })
        toast({ variant: "success", title: t("toasts.updated") })
        setEditTarget(null)
      } catch {
        toast({ variant: "error", title: t("toasts.updateError") })
      }
    },
    [editTarget, updateMutation, toast, t],
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast({ variant: "success", title: t("toasts.deleted") })
      setDeleteTarget(null)
    } catch {
      toast({ variant: "error", title: t("toasts.deleteError") })
    }
  }, [deleteTarget, deleteMutation, toast, t])

  function handleEdit(expense: SerializedExpense) {
    setEditTarget(expense)
  }

  function handleDelete(expense: SerializedExpense) {
    setDeleteTarget(expense)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        <Button
          variant="gradient"
          shape="pill"
          size="lg"
          onClick={() => setFormOpen(true)}
        >
          <PlusIcon className="size-5" />
          {t("newExpense")}
        </Button>
      </PageHeader>

      <ExpenseFilters clients={clients} />

      {isLoading ? (
        <PageSkeleton variant="list" />
      ) : (
        <>
          <ExpenseSummary expenses={expenses} />
          <ExpenseList
            expenses={expenses}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </>
      )}

      {/* Create dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("newExpense")}</DialogTitle>
            <DialogDescription>{t("newExpenseDesc")}</DialogDescription>
          </DialogHeader>
          <ExpenseForm
            clients={clients}
            onSubmit={handleCreate}
            onCancel={() => setFormOpen(false)}
            isSubmitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editExpense")}</DialogTitle>
            <DialogDescription>{t("editExpenseDesc")}</DialogDescription>
          </DialogHeader>
          <ExpenseForm
            clients={clients}
            defaultValues={editTarget}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            isSubmitting={updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <DeleteExpenseModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        description={deleteTarget?.description ?? ""}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
