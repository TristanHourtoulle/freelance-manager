"use client"

import { useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PlusIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { ClientFilters } from "@/components/clients/client-filters"
import { ClientList } from "@/components/clients/client-list"
import { ArchiveClientModal } from "@/components/clients/archive-client-modal"
import { TooltipHint } from "@/components/ui/tooltip-hint"
import { useToast } from "@/components/providers/toast-provider"
import { useClients, useArchiveClient } from "@/hooks/use-clients"

import type { SerializedClient } from "@/components/clients/types"

function getInitialView(): "grid" | "list" {
  if (typeof window === "undefined") return "grid"
  const stored = localStorage.getItem("clientListView")
  return stored === "list" ? "list" : "grid"
}

export default function ClientsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [view, setView] = useState<"grid" | "list">(getInitialView)
  const [archiveTarget, setArchiveTarget] = useState<SerializedClient | null>(
    null,
  )

  const { data, isLoading } = useClients(searchParams.toString())
  const archiveMutation = useArchiveClient()

  const clients = data?.items ?? []
  const pagination = data?.pagination ?? {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  }

  function handleViewChange(newView: "grid" | "list") {
    setView(newView)
    localStorage.setItem("clientListView", newView)
  }

  function handlePageChange(page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(page))
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleArchiveClick(id: string) {
    const client = clients.find((c) => c.id === id)
    if (client) setArchiveTarget(client)
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return

    const isArchived = Boolean(archiveTarget.archivedAt)

    archiveMutation.mutate(
      { clientId: archiveTarget.id, archive: !isArchived },
      {
        onSuccess: () => {
          toast({
            variant: "success",
            title: isArchived ? "Client unarchived" : "Client archived",
          })
          setArchiveTarget(null)
        },
        onError: () => {
          toast({
            variant: "error",
            title: isArchived
              ? "Failed to unarchive client"
              : "Failed to archive client",
          })
        },
      },
    )
  }

  const hasFilters = Boolean(
    searchParams.get("search") ||
    searchParams.get("category") ||
    searchParams.get("archived"),
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Clients">
        <Link href="/clients/new">
          <Button variant="gradient" shape="pill" size="lg">
            <PlusIcon className="size-5" />
            New Client
          </Button>
        </Link>
      </PageHeader>

      <TooltipHint storageKey="clients-page">
        Add your clients here. Set their billing mode and rate, then connect a
        Linear project from the client edit page.
      </TooltipHint>

      <ClientFilters view={view} onViewChange={handleViewChange} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">Loading clients...</p>
        </div>
      ) : (
        <ClientList
          clients={clients}
          pagination={pagination}
          hasFilters={hasFilters}
          view={view}
          onArchive={handleArchiveClick}
          onPageChange={handlePageChange}
        />
      )}

      {archiveTarget && (
        <ArchiveClientModal
          clientName={archiveTarget.name}
          isArchived={Boolean(archiveTarget.archivedAt)}
          isOpen={Boolean(archiveTarget)}
          onClose={() => setArchiveTarget(null)}
          onConfirm={handleArchiveConfirm}
          isLoading={archiveMutation.isPending}
        />
      )}
    </div>
  )
}
