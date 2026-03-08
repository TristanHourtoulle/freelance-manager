"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ListBulletIcon, ViewColumnsIcon } from "@heroicons/react/24/outline"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CategoryFilter } from "@/components/ui/category-filter"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import {
  TASK_PRESETS,
  TASK_PRESET_LABELS,
  type TaskPreset,
} from "@/lib/schemas/task"

import type { ClientSummary } from "./types"

export type TaskView = "list" | "kanban"

interface TaskFiltersProps {
  clients: ClientSummary[]
  view: TaskView
  onViewChange: (view: TaskView) => void
}

/**
 * Filter toolbar for the tasks page.
 * Provides preset tabs (active, billable, invoiced, all), client dropdown, and category filter.
 * All filter state is synced to URL search params.
 */
export function TaskFilters({ clients, view, onViewChange }: TaskFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  usePersistedFilters("tasks", ["preset", "clientId", "category"])

  const currentPreset: TaskPreset =
    (searchParams.get("preset") as TaskPreset) ?? "active"

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handlePresetChange(preset: TaskPreset) {
    if (preset === "active") {
      updateParam("preset", "")
    } else {
      updateParam("preset", preset)
    }
  }

  const clientId = searchParams.get("clientId") ?? ""

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {TASK_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetChange(preset)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                currentPreset === preset
                  ? "bg-primary text-primary-foreground hover:bg-primary/80"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {TASK_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
        <div className="flex items-center rounded-lg border border-border">
          <button
            onClick={() => onViewChange("list")}
            className={`cursor-pointer rounded-l-lg p-1.5 transition-colors ${
              view === "list"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            title="List view"
          >
            <ListBulletIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewChange("kanban")}
            className={`cursor-pointer rounded-r-lg p-1.5 transition-colors ${
              view === "kanban"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
            title="Kanban view"
          >
            <ViewColumnsIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Client
          </label>
          <Select
            value={clientId || undefined}
            onValueChange={(val) =>
              updateParam("clientId", val === "__all__" ? "" : (val ?? ""))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company ? `${c.name} (${c.company})` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <CategoryFilter />
    </div>
  )
}
