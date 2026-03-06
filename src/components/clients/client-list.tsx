"use client"

import { ClientCard } from "@/components/clients/client-card"
import { ClientEmptyState } from "@/components/clients/client-empty-state"
import { Button } from "@/components/ui/button"

import type { SerializedClient, Pagination } from "@/components/clients/types"

interface ClientListProps {
  clients: SerializedClient[]
  pagination: Pagination
  hasFilters: boolean
  onDelete: (id: string) => void
  onPageChange: (page: number) => void
}

export function ClientList({
  clients,
  pagination,
  hasFilters,
  onDelete,
  onPageChange,
}: ClientListProps) {
  if (clients.length === 0) {
    return <ClientEmptyState hasFilters={hasFilters} />
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.map((client) => (
          <ClientCard key={client.id} client={client} onDelete={onDelete} />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {pagination.total} client{pagination.total !== 1 ? "s" : ""} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="text-xs"
            >
              Previous
            </Button>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
