"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  ArchiveBoxIcon,
  ArchiveBoxArrowDownIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { ActivityIndicator } from "@/components/clients/activity-indicator"

import type { SerializedClient } from "@/components/clients/types"

const CATEGORY_BADGES: Record<string, string> = {
  FREELANCE: "bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400",
  STUDY:
    "bg-purple-100 text-purple-800 dark:bg-purple-500/10 dark:text-purple-400",
  PERSONAL:
    "bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400",
  SIDE_PROJECT:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
}

const CATEGORY_KEYS: Record<string, string> = {
  FREELANCE: "freelance",
  STUDY: "study",
  PERSONAL: "personal",
  SIDE_PROJECT: "sideProject",
}

const BILLING_KEYS: Record<string, string> = {
  HOURLY: "hourly",
  DAILY: "daily",
  FIXED: "fixed",
  FREE: "free",
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

interface ClientRowProps {
  client: SerializedClient
  onArchive: (id: string) => void
}

/** Table row displaying a single client in list view. Used by ClientList in list mode. */
export function ClientRow({ client, onArchive }: ClientRowProps) {
  const t = useTranslations("clientsTable")
  const tc = useTranslations("common.categories")
  const tb = useTranslations("common.billingModes")
  const tl = useTranslations("clients")

  const isArchived = Boolean(client.archivedAt)
  const rateDisplay =
    client.billingMode !== "FREE" && client.rate > 0
      ? `${client.rate}${client.billingMode === "HOURLY" ? "/h" : client.billingMode === "DAILY" ? "/d" : ""}`
      : "-"

  return (
    <tr
      className={`border-b border-border transition-colors hover:bg-surface-muted${isArchived ? " opacity-60" : ""}`}
    >
      <td className="px-3 py-3">
        <ActivityIndicator
          lastActivityAt={client.lastActivityAt}
          showLabel={false}
        />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Link href={`/clients/${client.id}`}>
            <span className="font-medium text-text-primary hover:underline">
              {client.name}
            </span>
          </Link>
          {isArchived && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-500/10 dark:text-gray-400">
              {tl("archived")}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-sm text-text-secondary">
        {client.company ?? "-"}
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGES[client.category] ?? ""}`}
        >
          {tc(CATEGORY_KEYS[client.category] ?? "freelance")}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-text-secondary">
        {tb(BILLING_KEYS[client.billingMode] ?? "hourly")}
      </td>
      <td className="px-3 py-3 text-sm font-medium text-text-primary">
        {rateDisplay}
      </td>
      <td className="px-3 py-3 text-sm font-medium text-text-primary">
        {client.totalRevenue > 0
          ? currencyFormatter.format(client.totalRevenue)
          : "-"}
      </td>
      <td className="px-3 py-3">
        <ActivityIndicator lastActivityAt={client.lastActivityAt} />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="ghost" className="text-xs">
              {t("edit")}
            </Button>
          </Link>
          <button
            className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
            onClick={() => onArchive(client.id)}
            title={isArchived ? tl("unarchiveClient") : tl("archiveClient")}
          >
            {isArchived ? (
              <ArchiveBoxArrowDownIcon className="h-4 w-4" />
            ) : (
              <ArchiveBoxIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </td>
    </tr>
  )
}
