"use client"

import { useTranslations } from "next-intl"
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

/**
 * Renders the client collection in either grid (ClientCard) or list (ClientRow) mode
 * with pagination controls. Falls back to ClientEmptyState when empty.
 * Used on the clients page.
 */
export function ClientList({
  clients,
  pagination,
  hasFilters,
  view,
  onArchive,
  onPageChange,
}: ClientListProps) {
  const t = useTranslations("clientsTable")
  const tc = useTranslations("clients")

  if (clients.length === 0) {
    return <ClientEmptyState hasFilters={hasFilters} />
  }

  return (
    <div className="space-y-4">
      {view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  {t("name")}
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  {t("company")}
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  {t("category")}
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  {t("billing")}
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  {t("rate")}
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  {t("revenue")}
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  {t("lastActivity")}
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
            {tc("total", { count: pagination.total })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="text-xs"
            >
              {tc("previous")}
            </Button>
            <span className="text-sm text-text-secondary">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="text-xs"
            >
              {tc("next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
