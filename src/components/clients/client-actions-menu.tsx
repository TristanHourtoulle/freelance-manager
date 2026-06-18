"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/components/providers/toast-provider"
import { useRouter } from "next/navigation"
import {
  useArchiveClient,
  useDeleteClient,
  useDuplicateClient,
} from "@/hooks/use-clients"

interface ClientActionsMenuProps {
  clientId: string
  clientLabel: string
  archived: boolean
  /** Called after archive succeeds so the parent can refetch / route away. */
  onArchived?: () => void
}

/**
 * "More" dropdown next to the Modifier button on the client detail page.
 * Exposes Dupliquer, Récap PDF, Archiver and Supprimer (soft-delete).
 *
 * @param clientLabel Human-readable name used in confirm dialogs and toasts.
 * @param onArchived Optional callback fired once archive succeeds (used by
 *                   the desktop page to navigate back to /clients).
 */
export function ClientActionsMenu({
  clientId,
  clientLabel,
  archived,
  onArchived,
}: ClientActionsMenuProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const duplicate = useDuplicateClient()
  const archive = useArchiveClient()
  const remove = useDeleteClient()

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  function handleDuplicate() {
    setOpen(false)
    duplicate.mutate(clientId, {
      onSuccess: (created) => {
        toast({
          variant: "success",
          title: "Client dupliqué",
          description: "Vous êtes redirigé vers la copie.",
        })
        router.push(`/clients/${created.id}`)
      },
      onError: (e) => {
        toast({
          variant: "error",
          title: "Échec de la duplication",
          description: e instanceof Error ? e.message : String(e),
        })
      },
    })
  }

  function handleRecap() {
    setOpen(false)
    window.open(`/api/clients/${clientId}/recap`, "_blank", "noopener")
  }

  function handleArchive() {
    archive.mutate(clientId, {
      onSuccess: () => {
        toast({ variant: "success", title: "Client archivé" })
        setArchiveOpen(false)
        onArchived?.()
      },
      onError: (e) => {
        toast({
          variant: "error",
          title: "Échec de l'archivage",
          description: e instanceof Error ? e.message : String(e),
        })
      },
    })
  }

  function handleDelete() {
    remove.mutate(clientId, {
      onSuccess: () => {
        toast({ variant: "success", title: "Client supprimé" })
        setDeleteOpen(false)
        onArchived?.()
      },
      onError: (e) => {
        toast({
          variant: "error",
          title: "Échec de la suppression",
          description: e instanceof Error ? e.message : String(e),
        })
      },
    })
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ padding: "8px 10px" }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Plus d'actions"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="more" size={14} />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={handleDuplicate}
            disabled={duplicate.isPending}
          >
            <Icon name="copy" size={14} />
            Dupliquer
          </button>
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={handleRecap}
          >
            <Icon name="download" size={14} />
            Récap PDF
          </button>
          {!archived && (
            <button
              type="button"
              className="menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                setArchiveOpen(true)
              }}
            >
              <Icon name="archive" size={14} />
              Archiver
            </button>
          )}
          <div className="menu-sep" />
          <button
            type="button"
            className="menu-item danger"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setDeleteOpen(true)
            }}
          >
            <Icon name="trash" size={14} />
            Supprimer
          </button>
        </div>
      )}

      {archiveOpen && (
        <ConfirmDialog
          title="Archiver le client ?"
          description={`${clientLabel} sera retiré de la liste active. Vous pourrez le restaurer depuis les archives.`}
          confirmLabel="Archiver"
          icon="archive"
          danger
          isPending={archive.isPending}
          onCancel={() => setArchiveOpen(false)}
          onConfirm={handleArchive}
        />
      )}
      {deleteOpen && (
        <ConfirmDialog
          title="Supprimer le client ?"
          description={`${clientLabel} sera retiré de votre tableau de bord. Cette action soft-delete le client et ses données restent en base.`}
          confirmLabel="Supprimer"
          icon="trash"
          danger
          isPending={remove.isPending}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
