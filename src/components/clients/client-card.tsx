"use client"

import Link from "next/link"
import {
  ArchiveBoxIcon,
  ArchiveBoxArrowDownIcon,
  PencilSquareIcon,
  CurrencyEuroIcon,
  ClockIcon,
  CalendarDaysIcon,
  LinkIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { ActivityIndicator } from "@/components/clients/activity-indicator"

import type { SerializedClient } from "@/components/clients/types"

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const CATEGORY_BADGES: Record<string, string> = {
  FREELANCE: "bg-blue-50 text-blue-700 ring-blue-600/20",
  STUDY: "bg-purple-50 text-purple-700 ring-purple-600/20",
  PERSONAL: "bg-green-50 text-green-700 ring-green-600/20",
  SIDE_PROJECT: "bg-amber-50 text-amber-700 ring-amber-600/20",
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

const BILLING_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  HOURLY: ClockIcon,
  DAILY: CalendarDaysIcon,
  FIXED: CurrencyEuroIcon,
  FREE: CurrencyEuroIcon,
}

interface ClientCardProps {
  client: SerializedClient
  onArchive: (id: string) => void
}

export function ClientCard({ client, onArchive }: ClientCardProps) {
  const isArchived = Boolean(client.archivedAt)
  const BillingIcon = BILLING_ICONS[client.billingMode] ?? CurrencyEuroIcon

  return (
    <div
      className={`flex h-full flex-col rounded-xl border border-border bg-surface shadow-sm transition-all hover:shadow-md hover:border-border-hover ${isArchived ? "opacity-60" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-5 pb-0">
        <ActivityIndicator
          lastActivityAt={client.lastActivityAt}
          showLabel={false}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-text-primary">
            {client.name}
          </h3>
          {client.company && (
            <p className="truncate text-sm text-text-secondary">
              {client.company}
            </p>
          )}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${CATEGORY_BADGES[client.category] ?? "bg-gray-50 text-gray-700 ring-gray-600/20"}`}
        >
          {CATEGORY_LABELS[client.category] ?? client.category}
        </span>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 px-5 pt-4">
        <div className="flex items-center gap-2 rounded-lg bg-surface-secondary/50 px-3 py-2">
          <BillingIcon className="h-4 w-4 shrink-0 text-text-muted" />
          <div className="min-w-0">
            <p className="text-xs text-text-muted">Billing</p>
            <p className="truncate text-sm font-medium text-text-primary">
              {BILLING_LABELS[client.billingMode] ?? client.billingMode}
              {client.billingMode !== "FREE" && client.rate > 0 && (
                <span className="ml-1 text-text-secondary">
                  {client.rate}
                  {client.billingMode === "HOURLY"
                    ? "/h"
                    : client.billingMode === "DAILY"
                      ? "/d"
                      : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-surface-secondary/50 px-3 py-2">
          <CurrencyEuroIcon className="h-4 w-4 shrink-0 text-text-muted" />
          <div className="min-w-0">
            <p className="text-xs text-text-muted">Revenue</p>
            <p className="truncate text-sm font-medium text-text-primary">
              {client.totalRevenue > 0
                ? currencyFormatter.format(client.totalRevenue)
                : "---"}
            </p>
          </div>
        </div>
      </div>

      {/* Activity & Linear */}
      <div className="flex items-center justify-between px-5 pt-3">
        <ActivityIndicator lastActivityAt={client.lastActivityAt} />
        {client.linearMappings && client.linearMappings.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
            <LinkIcon className="h-3 w-3" />
            {client.linearMappings.length} project
            {client.linearMappings.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isArchived && (
        <div className="mx-5 mt-3">
          <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
            Archived
          </span>
        </div>
      )}

      {/* Footer actions — always at bottom */}
      <div className="mt-auto flex items-center justify-end gap-2 border-t border-border-light px-5 py-3">
        <Link href={`/clients/${client.id}/edit`}>
          <Button variant="ghost" className="gap-1.5 text-xs">
            <PencilSquareIcon className="h-3.5 w-3.5" />
            Edit
          </Button>
        </Link>
        <button
          className="cursor-pointer rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
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
