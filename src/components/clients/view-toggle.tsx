"use client"

import { Squares2X2Icon, ListBulletIcon } from "@heroicons/react/24/outline"

interface ViewToggleProps {
  view: "grid" | "list"
  onViewChange: (view: "grid" | "list") => void
}

/** Toggle button pair for switching between grid and list views. Used in ClientFilters. */
export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border border-border">
      <button
        onClick={() => onViewChange("grid")}
        className={`rounded-l-lg p-1.5 transition-colors ${
          view === "grid"
            ? "bg-surface-muted text-text-primary"
            : "text-text-secondary hover:text-text-primary"
        }`}
        title="Grid view"
      >
        <Squares2X2Icon className="h-4 w-4" />
      </button>
      <button
        onClick={() => onViewChange("list")}
        className={`rounded-r-lg p-1.5 transition-colors ${
          view === "list"
            ? "bg-surface-muted text-text-primary"
            : "text-text-secondary hover:text-text-primary"
        }`}
        title="List view"
      >
        <ListBulletIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
