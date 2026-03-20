"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Modal } from "@/components/ui/modal"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import {
  useClientNotes,
  useCreateClientNote,
  useUpdateClientNote,
  useDeleteClientNote,
} from "@/hooks/use-client-notes"
import type { ClientNote } from "@/hooks/use-client-notes"

interface ClientNotesProps {
  clientId: string
}

/**
 * Displays a list of notes/journal entries for a client.
 * Supports creating, editing, and deleting notes via modals.
 */
export function ClientNotes({ clientId }: ClientNotesProps) {
  const t = useTranslations("clientNotes")
  const { data, isLoading } = useClientNotes(clientId)
  const createMutation = useCreateClientNote(clientId)
  const updateMutation = useUpdateClientNote(clientId)
  const deleteMutation = useDeleteClientNote(clientId)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<ClientNote | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClientNote | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState("")
  const [formContent, setFormContent] = useState("")

  const openCreateForm = useCallback(() => {
    setEditingNote(null)
    setFormTitle("")
    setFormContent("")
    setIsFormOpen(true)
  }, [])

  const openEditForm = useCallback((note: ClientNote) => {
    setEditingNote(note)
    setFormTitle(note.title)
    setFormContent(note.content)
    setIsFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setIsFormOpen(false)
    setEditingNote(null)
    setFormTitle("")
    setFormContent("")
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!formTitle.trim() || !formContent.trim()) return

    if (editingNote) {
      await updateMutation.mutateAsync({
        noteId: editingNote.id,
        data: { title: formTitle.trim(), content: formContent.trim() },
      })
    } else {
      await createMutation.mutateAsync({
        title: formTitle.trim(),
        content: formContent.trim(),
      })
    }

    closeForm()
  }, [
    formTitle,
    formContent,
    editingNote,
    updateMutation,
    createMutation,
    closeForm,
  ])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    await deleteMutation.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }, [deleteTarget, deleteMutation])

  const notes = data?.items ?? []
  const isSaving = createMutation.isPending || updateMutation.isPending

  if (isLoading) {
    return <Skeleton className="h-48 rounded-xl" />
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("title")}</CardTitle>
          <Button
            variant="gradient"
            size="lg"
            shape="pill"
            onClick={openCreateForm}
          >
            <PlusIcon className="size-4" />
            {t("newNote")}
          </Button>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("noNotesHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  onEdit={openEditForm}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open && !isSaving) closeForm()
        }}
      >
        <DialogContent showCloseButton={!isSaving}>
          <DialogHeader>
            <DialogTitle>
              {editingNote ? t("editNote") : t("newNote")}
            </DialogTitle>
            <DialogDescription>
              {editingNote ? t("editNote") : t("newNote")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t("noteTitle")}
              </label>
              <Input
                className="h-[38px] px-4"
                style={{ borderRadius: "9999px" }}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t("noteTitle")}
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {t("noteContent")}
              </label>
              <textarea
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[120px] resize-y"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder={t("noteContent")}
                disabled={isSaving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm} disabled={isSaving}>
              {t("cancel")}
            </Button>
            <Button
              variant="default"
              onClick={handleSubmit}
              isLoading={isSaving}
              disabled={!formTitle.trim() || !formContent.trim()}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("deleteNote")}
        description={t("deleteConfirm")}
        confirmLabel={t("deleteNote")}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </>
  )
}

interface NoteItemProps {
  note: ClientNote
  onEdit: (note: ClientNote) => void
  onDelete: (note: ClientNote) => void
}

function NoteItem({ note, onEdit, onDelete }: NoteItemProps) {
  const t = useTranslations("clientNotes")

  const createdDate = new Date(note.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const updatedDate = new Date(note.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const isEdited = note.createdAt !== note.updatedAt

  return (
    <div className="group rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-foreground">{note.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">
            {note.content}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {t("created")} {createdDate}
            </span>
            {isEdited && (
              <span>
                {t("updated")} {updatedDate}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(note)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("editNote")}
          >
            <PencilIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(note)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={t("deleteNote")}
          >
            <TrashIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
