"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PlusIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { ClientFilters } from "@/components/clients/client-filters"
import { ClientList } from "@/components/clients/client-list"
import { ArchiveClientModal } from "@/components/clients/archive-client-modal"
import { TooltipHint } from "@/components/ui/tooltip-hint"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { useToast } from "@/components/providers/toast-provider"
import { useClients, useArchiveClient } from "@/hooks/use-clients"
import { usePageShortcuts } from "@/hooks/use-page-shortcuts"

import type { SerializedClient } from "@/components/clients/types"

function getInitialView(): "grid" | "list" {
  if (typeof window === "undefined") return "grid"
  const stored = localStorage.getItem("clientListView")
  return stored === "list" ? "list" : "grid"
}

export default function ClientsPage() {
  const t = useTranslations("clients")
  const tc = useTranslations("common")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  usePageShortcuts({
    onNew: useCallback(() => router.push("/clients/new"), [router]),
  })

  const [view, setView] = useState<"grid" | "list">(getInitialView)
  const [archiveTarget, setArchiveTarget] = useState<SerializedClient | null>(
    null,
  )

  const { data, isLoading, isFetching } = useClients(searchParams.toString())
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
            title: isArchived ? t("toasts.unarchived") : t("toasts.archived"),
          })
          setArchiveTarget(null)
        },
        onError: () => {
          toast({
            variant: "error",
            title: isArchived
              ? t("toasts.unarchiveError")
              : t("toasts.archiveError"),
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
      <PageHeader title={t("title")}>
        <Link href="/clients/new">
          <Button variant="gradient" shape="pill" size="lg">
            <PlusIcon className="size-5" />
            {t("newClient")}
          </Button>
        </Link>
      </PageHeader>

      <TooltipHint storageKey="clients-page">{t("hint")}</TooltipHint>

      <ClientFilters view={view} onViewChange={handleViewChange} />

      {isLoading ? (
        <PageSkeleton variant={view === "grid" ? "grid" : "list"} />
      ) : (
        <div
          className={
            isFetching ? "opacity-50 transition-opacity" : "transition-opacity"
          }
        >
          <ClientList
            clients={clients}
            pagination={pagination}
            hasFilters={hasFilters}
            view={view}
            onArchive={handleArchiveClick}
            onPageChange={handlePageChange}
          />
        </div>
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
