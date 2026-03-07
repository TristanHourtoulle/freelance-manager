"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ClientFilters } from "@/components/clients/client-filters"
import { ClientList } from "@/components/clients/client-list"
import { DeleteClientModal } from "@/components/clients/delete-client-modal"

import type { SerializedClient, Pagination } from "@/components/clients/types"

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

  const [deleteTarget, setDeleteTarget] = useState<SerializedClient | null>(
    null,
  )
  const [isDeleting, setIsDeleting] = useState(false)

  const [refreshKey, setRefreshKey] = useState(0)

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

  function handleDeleteClick(id: string) {
    const client = clients.find((c) => c.id === id)
    if (client) setDeleteTarget(client)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setIsDeleting(true)

    const res = await fetch(`/api/clients/${deleteTarget.id}`, {
      method: "DELETE",
    })

    if (res.ok) {
      setDeleteTarget(null)
      refreshClients()
    }
    setIsDeleting(false)
  }

  const hasFilters = Boolean(
    searchParams.get("search") || searchParams.get("category"),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Clients</h1>
        <Link href="/clients/new">
          <Button>New Client</Button>
        </Link>
      </div>

      <ClientFilters />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">Loading clients...</p>
        </div>
      ) : (
        <ClientList
          clients={clients}
          pagination={pagination}
          hasFilters={hasFilters}
          onDelete={handleDeleteClick}
          onPageChange={handlePageChange}
        />
      )}

      {deleteTarget && (
        <DeleteClientModal
          clientName={deleteTarget.name}
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}
