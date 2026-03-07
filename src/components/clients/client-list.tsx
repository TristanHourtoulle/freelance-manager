"use client"

import { ClientCard } from "@/components/clients/client-card"
import { ClientRow } from "@/components/clients/client-row"
import { ClientEmptyState } from "@/components/clients/client-empty-state"
import { Button } from "@/components/ui/button"

import type { SerializedClient, Pagination } from "@/components/clients/types"

interface ClientListProps {
  clients: SerializedClient[]
  pagination: Pagination
  hasFilters: boolean
  view: "grid" | "list"
  onArchive: (id: string) => void
  onPageChange: (page: number) => void
}

export function ClientList({
  clients,
  pagination,
  hasFilters,
  view,
  onArchive,
  onPageChange,
}: ClientListProps) {
  if (clients.length === 0) {
    return <ClientEmptyState hasFilters={hasFilters} />
  }

  return (
    <div className="space-y-4">
      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} onArchive={onArchive} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted">
              <tr>
                <th className="px-3 py-2 font-medium text-text-secondary" />
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Name
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Company
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Category
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Billing
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Rate
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Revenue
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  Last Activity
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <ClientRow
                  key={client.id}
                  client={client}
                  onArchive={onArchive}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-text-secondary">
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
            <span className="text-sm text-text-secondary">
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
