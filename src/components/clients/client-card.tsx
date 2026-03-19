"use client"

import Link from "next/link"
import {
  ArchiveBoxIcon,
  ArchiveBoxArrowDownIcon,
  PencilSquareIcon,
  LinkIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { ActivityIndicator } from "@/components/clients/activity-indicator"
import { formatCurrency } from "@/lib/format"

import type { SerializedClient } from "@/components/clients/types"

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatRate(billingMode: string, rate: number): string {
  if (billingMode === "FREE" || rate === 0) return "---"
  const suffix =
    billingMode === "HOURLY" ? "/h" : billingMode === "DAILY" ? "/d" : ""
  return `${rate}€${suffix}`
}

interface ClientCardProps {
  client: SerializedClient
  onArchive: (id: string) => void
}

export function ClientCard({ client, onArchive }: ClientCardProps) {
  const isArchived = Boolean(client.archivedAt)
  const linearCount = client.linearMappings?.length ?? 0

  return (
    <div
      className={`flex h-full flex-col rounded-xl border border-border bg-surface transition-all hover:shadow-md hover:border-border-hover ${isArchived ? "opacity-60" : ""}`}
    >
      {/* Header: avatar + name + category */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-[#2563eb] to-[#1442a9] text-xs font-medium text-white">
          {getInitials(client.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {client.name}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {client.company || "No company"}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CATEGORY_BADGES[client.category] ?? "bg-gray-50 text-gray-700 ring-gray-600/20"}`}
        >
          {CATEGORY_LABELS[client.category] ?? client.category}
        </span>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-px border-y border-border bg-border">
        <div className="flex flex-col items-center justify-center bg-surface px-2 py-3">
          <span className="text-xs text-muted-foreground">Billing</span>
          <span className="mt-0.5 text-sm font-medium text-foreground">
            {BILLING_LABELS[client.billingMode] ?? client.billingMode}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center bg-surface px-2 py-3">
          <span className="text-xs text-muted-foreground">Rate</span>
          <span className="mt-0.5 text-sm font-medium text-foreground">
            {formatRate(client.billingMode, client.rate)}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center bg-surface px-2 py-3">
          <span className="text-xs text-muted-foreground">Revenue</span>
          <span className="mt-0.5 text-sm font-medium text-foreground">
            {client.totalRevenue > 0
              ? formatCurrency(client.totalRevenue)
              : "---"}
          </span>
        </div>
      </div>

      {/* Footer: activity + linear + actions */}
      <div className="mt-auto flex items-center gap-2 px-4 py-3">
        <ActivityIndicator lastActivityAt={client.lastActivityAt} />

        {linearCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
            <LinkIcon className="size-3" />
            {linearCount}
          </span>
        )}

        {isArchived && (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
            Archived
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="ghost" size="icon-sm">
              <PencilSquareIcon className="size-4" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onArchive(client.id)}
            title={isArchived ? "Unarchive client" : "Archive client"}
          >
            {isArchived ? (
              <ArchiveBoxArrowDownIcon className="size-4" />
            ) : (
              <ArchiveBoxIcon className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
