"use client"

import { ArrowPathIcon } from "@heroicons/react/24/outline"

interface SyncStatusBarProps {
  lastSyncedAt: number | null
  isStale: boolean
  onRefresh: () => void
  isRefreshing: boolean
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin} min ago`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return `${Math.floor(diffHours / 24)}d ago`
}

export function SyncStatusBar({
  lastSyncedAt,
  isStale,
  onRefresh,
  isRefreshing,
}: SyncStatusBarProps) {
  const label =
    lastSyncedAt === null
      ? "Never synced"
      : `Last synced: ${formatRelativeTime(lastSyncedAt)}`

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
        Refresh
      </button>
    </div>
  )
}
