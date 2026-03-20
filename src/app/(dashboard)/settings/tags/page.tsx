"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useToast } from "@/components/providers/toast-provider"
import {
  useTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
} from "@/hooks/use-tags"

const TAG_COLORS = [
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
]

interface TagDTO {
  id: string
  name: string
  color: string
}

export default function TagsSettingsPage() {
  const t = useTranslations("tags")
  const { data: tagsData, isLoading } = useTags()
  const tags = tagsData?.items
  const createTag = useCreateTag()
  const updateTag = useUpdateTag()
  const deleteTag = useDeleteTag()
  const { toast } = useToast()

  const [isCreating, setIsCreating] = useState(false)
  const [editTarget, setEditTarget] = useState<TagDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TagDTO | null>(null)
  const [name, setName] = useState("")
  const [color, setColor] = useState(TAG_COLORS[0]!)

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    try {
      await createTag.mutateAsync({ name: name.trim(), color })
      setName("")
      setColor(TAG_COLORS[0]!)
      setIsCreating(false)
    } catch {
      toast({ variant: "error", title: "Failed to create tag" })
    }
  }, [name, color, createTag, toast])

  const handleUpdate = useCallback(async () => {
    if (!editTarget || !name.trim()) return
    try {
      await updateTag.mutateAsync({
        id: editTarget.id,
        data: { name: name.trim(), color },
      })
      setEditTarget(null)
      setName("")
    } catch {
      toast({ variant: "error", title: "Failed to update tag" })
    }
  }, [editTarget, name, color, updateTag, toast])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteTag.mutateAsync(deleteTarget.id)
      setDeleteTarget(null)
    } catch {
      toast({ variant: "error", title: "Failed to delete tag" })
    }
  }, [deleteTarget, deleteTag, toast])

  const openEdit = (tag: TagDTO) => {
    setEditTarget(tag)
    setName(tag.name)
    setColor(tag.color)
  }

  const openCreate = () => {
    setIsCreating(true)
    setName("")
    setColor(TAG_COLORS[0]!)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        <Button variant="gradient" shape="pill" size="lg" onClick={openCreate}>
          <PlusIcon className="size-5" />
          {t("addTag")}
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : !tags || tags.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">{t("noTags")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface divide-y divide-border">
          {tags.map((tag: TagDTO) => (
            <div key={tag.id} className="flex items-center gap-3 px-5 py-3.5">
              <div
                className="size-4 rounded-full shrink-0"
                style={{ backgroundColor: tag.color }}
              />
              <span className="text-sm font-medium text-foreground flex-1">
                {tag.name}
              </span>
              <button
                onClick={() => openEdit(tag)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
              >
                <PencilIcon className="size-4" />
              </button>
              <button
                onClick={() => setDeleteTarget(tag)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <TrashIcon className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={isCreating}
        onOpenChange={(v) => {
          if (!v) setIsCreating(false)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("addTag")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t("tagName")}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Urgent"
                className="h-[38px] px-4"
                style={{ borderRadius: "9999px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate()
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t("tagColor")}
              </label>
              <div className="flex gap-2">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-7 rounded-full transition-all ${
                      color === c ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <Button
                variant="outline"
                shape="pill-left"
                size="lg"
                onClick={() => setIsCreating(false)}
              >
                {t("cancel") || "Cancel"}
              </Button>
              <Button
                variant="gradient"
                shape="pill-right"
                size="lg"
                onClick={handleCreate}
                isLoading={createTag.isPending}
                disabled={!name.trim()}
              >
                {t("createButton")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(v) => {
          if (!v) setEditTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("editTag")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t("tagName")}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-[38px] px-4"
                style={{ borderRadius: "9999px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUpdate()
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t("tagColor")}
              </label>
              <div className="flex gap-2">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-7 rounded-full transition-all ${
                      color === c ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <Button
                variant="outline"
                shape="pill-left"
                size="lg"
                onClick={() => setEditTarget(null)}
              >
                {t("cancel") || "Cancel"}
              </Button>
              <Button
                variant="gradient"
                shape="pill-right"
                size="lg"
                onClick={handleUpdate}
                isLoading={updateTag.isPending}
                disabled={!name.trim()}
              >
                {t("createButton")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteTag")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              shape="pill-left"
              size="lg"
              onClick={() => setDeleteTarget(null)}
            >
              {t("cancel") || "Cancel"}
            </Button>
            <Button
              variant="destructive"
              shape="pill-right"
              size="lg"
              onClick={handleDelete}
              isLoading={deleteTag.isPending}
            >
              {t("deleteTag")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
