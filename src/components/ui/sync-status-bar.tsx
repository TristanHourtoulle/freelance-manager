"use client"

import { useState } from "react"
import { ArrowPathIcon } from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"

interface SyncStatusBarProps {
  lastSyncedAt: number | null
  isStale: boolean
  onRefresh: () => void
  isRefreshing: boolean
}

/**
 * Inline status indicator showing the last sync time with a manual refresh button.
 * Displays a green or amber dot depending on whether data is stale.
 * Used on pages that cache external data (e.g. Linear issues).
 *
 * @param lastSyncedAt - Unix timestamp of the last successful sync, or null if never synced
 * @param isStale - When true, the status dot turns amber to signal outdated data
 * @param onRefresh - Callback triggered when the user clicks the refresh button
 * @param isRefreshing - When true, disables the button and shows a spinning icon
 */
export function SyncStatusBar({
  lastSyncedAt,
  isStale,
  onRefresh,
  isRefreshing,
}: SyncStatusBarProps) {
  const t = useTranslations("syncBar")
  const [now] = useState(() => Date.now())

  function formatRelativeTime(timestamp: number): string {
    const diffMs = now - timestamp
    const diffMin = Math.floor(diffMs / 60_000)

    if (diffMin < 1) return t("justNow")
    if (diffMin < 60) return t("minAgo", { min: diffMin })

    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return t("hoursAgo", { hours: diffHours })

    return t("daysAgo", { days: Math.floor(diffHours / 24) })
  }

  const label =
    lastSyncedAt === null
      ? t("neverSynced")
      : t("lastSynced", { time: formatRelativeTime(lastSyncedAt) })

  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          isStale ? "bg-amber-400" : "bg-emerald-400"
        }`}
      />
      <span className="text-sm text-text-secondary">{label}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-sm text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowPathIcon
          className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
        />
        {t("refresh")}
      </button>
    </div>
  )
}
