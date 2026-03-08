"use client"

import Link from "next/link"
import {
  ArchiveBoxIcon,
  ArchiveBoxArrowDownIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { ActivityIndicator } from "@/components/clients/activity-indicator"

import type { SerializedClient } from "@/components/clients/types"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const CATEGORY_BADGES: Record<string, string> = {
  FREELANCE: "bg-blue-100 text-blue-800",
  STUDY: "bg-purple-100 text-purple-800",
  PERSONAL: "bg-green-100 text-green-800",
  SIDE_PROJECT: "bg-amber-100 text-amber-800",
}

const CATEGORY_LABELS: Record<string, string> = {
  FREELANCE: "Freelance",
  STUDY: "Study",
  PERSONAL: "Personal",
  SIDE_PROJECT: "Side Project",
}

const BILLING_LABELS: Record<string, string> = {
  HOURLY: "Hourly",
  DAILY: "Daily",
  FIXED: "Fixed",
  FREE: "Free",
}

interface ClientCardProps {
  client: SerializedClient
  onArchive: (id: string) => void
}

/** Grid-view card displaying a client summary (name, billing, revenue, activity). Used by ClientList in grid mode. */
export function ClientCard({ client, onArchive }: ClientCardProps) {
  const isArchived = Boolean(client.archivedAt)

  return (
    <div
      className={`rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md${isArchived ? " opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ActivityIndicator
              lastActivityAt={client.lastActivityAt}
              showLabel={false}
            />
            <h3 className="truncate text-base font-semibold text-text-primary">
              {client.name}
            </h3>
            <span
              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGES[client.category] ?? ""}`}
            >
              {CATEGORY_LABELS[client.category] ?? client.category}
            </span>
            {isArchived && (
              <span className="inline-flex shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                Archived
              </span>
            )}
          </div>
          {client.company && (
            <p className="mt-1 text-sm text-text-secondary">{client.company}</p>
          )}
          {client.email && (
            <p className="mt-0.5 text-sm text-text-secondary">{client.email}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-text-secondary">
        <span>{BILLING_LABELS[client.billingMode] ?? client.billingMode}</span>
        {client.billingMode !== "FREE" && client.rate > 0 && (
          <span className="font-medium text-text-primary">
            {client.rate}
            {client.billingMode === "HOURLY"
              ? "/h"
              : client.billingMode === "DAILY"
                ? "/d"
                : ""}
          </span>
        )}
        {client.linearMappings && client.linearMappings.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {client.linearMappings.length} Linear project
            {client.linearMappings.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-sm">
        <ActivityIndicator lastActivityAt={client.lastActivityAt} />
        {client.totalRevenue > 0 && (
          <span className="font-medium text-text-primary">
            {currencyFormatter.format(client.totalRevenue)}
          </span>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Link href={`/clients/${client.id}/edit`}>
          <Button variant="ghost" className="text-xs">
            Edit
          </Button>
        </Link>
        <button
          className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-gray-100 hover:text-text-primary"
          onClick={() => onArchive(client.id)}
          title={isArchived ? "Unarchive client" : "Archive client"}
        >
          {isArchived ? (
            <ArchiveBoxArrowDownIcon className="h-4 w-4" />
          ) : (
            <ArchiveBoxIcon className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  )
}
