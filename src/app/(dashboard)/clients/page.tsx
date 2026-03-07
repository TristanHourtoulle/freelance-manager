"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ClientFilters } from "@/components/clients/client-filters"
import { ClientList } from "@/components/clients/client-list"
import { ArchiveClientModal } from "@/components/clients/archive-client-modal"
import { TooltipHint } from "@/components/ui/tooltip-hint"

import type { SerializedClient, Pagination } from "@/components/clients/types"

function getInitialView(): "grid" | "list" {
  if (typeof window === "undefined") return "grid"
  const stored = localStorage.getItem("clientListView")
  return stored === "list" ? "list" : "grid"
}

export default function ClientsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [clients, setClients] = useState<SerializedClient[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [view, setView] = useState<"grid" | "list">(getInitialView)

  const [archiveTarget, setArchiveTarget] = useState<SerializedClient | null>(
    null,
  )
  const [isArchiving, setIsArchiving] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

  function handleViewChange(newView: "grid" | "list") {
    setView(newView)
    localStorage.setItem("clientListView", newView)
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      const res = await fetch(`/api/clients?${searchParams.toString()}`, {
        cache: "no-store",
      })
      if (!cancelled && res.ok) {
        const data = await res.json()
        setClients(data.items)
        setPagination(data.pagination)
      }
      if (!cancelled) setIsLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [searchParams, refreshKey])

  function refreshClients() {
    setRefreshKey((k) => k + 1)
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
    setIsArchiving(true)

    const isArchived = Boolean(archiveTarget.archivedAt)
    const endpoint = isArchived ? "unarchive" : "archive"

    const res = await fetch(`/api/clients/${archiveTarget.id}/${endpoint}`, {
      method: "PATCH",
    })

    if (res.ok) {
      setArchiveTarget(null)
      refreshClients()
    }
    setIsArchiving(false)
  }

  const hasFilters = Boolean(
    searchParams.get("search") ||
    searchParams.get("category") ||
    searchParams.get("archived"),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Clients</h1>
        <Link href="/clients/new">
          <Button>New Client</Button>
        </Link>
      </div>

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
          isLoading={isArchiving}
        />
      )}
    </div>
  )
}
