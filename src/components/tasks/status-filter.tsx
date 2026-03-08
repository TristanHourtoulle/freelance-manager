"use client"

import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline"

import type { TaskStatusDTO } from "./types"

interface StatusFilterProps {
  allStatuses: TaskStatusDTO[]
  hiddenStatusIds: Set<string>
  onToggleStatus: (statusId: string) => void
  onShowAll: () => void
}

/**
 * Pill-based multi-select filter for Linear workflow statuses.
 * Each pill shows a colored dot and the status name.
 * Hidden statuses appear dimmed with a strikethrough.
 */
export function StatusFilter({
  allStatuses,
  hiddenStatusIds,
  onToggleStatus,
  onShowAll,
}: StatusFilterProps) {
  if (allStatuses.length === 0) return null

  const hasHidden = hiddenStatusIds.size > 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-muted-foreground">
          Status
        </label>
        {hasHidden && (
          <button
            type="button"
            onClick={onShowAll}
            className="cursor-pointer text-xs text-primary hover:underline"
          >
            Show all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allStatuses.map((status) => {
          const isHidden = hiddenStatusIds.has(status.id)

          return (
            <button
              key={status.id}
              type="button"
              onClick={() => onToggleStatus(status.id)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isHidden
                  ? "border-border bg-muted/50 text-muted-foreground line-through opacity-50"
                  : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
              title={
                isHidden ? `Show "${status.name}"` : `Hide "${status.name}"`
              }
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              {status.name}
              {isHidden ? (
                <EyeSlashIcon className="h-3 w-3" />
              ) : (
                <EyeIcon className="h-3 w-3" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
