"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Select } from "@/components/ui/select"
import { CategoryFilter } from "@/components/ui/category-filter"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import {
  TASK_PRESETS,
  TASK_PRESET_LABELS,
  type TaskPreset,
} from "@/lib/schemas/task"

import type { ClientSummary } from "./types"

interface TaskFiltersProps {
  clients: ClientSummary[]
}

/**
 * Filter toolbar for the tasks page.
 * Provides preset tabs (active, billable, invoiced, all), client dropdown, and category filter.
 * All filter state is synced to URL search params.
 */
export function TaskFilters({ clients }: TaskFiltersProps) {
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

  const clientOptions = [
    { value: "", label: "All clients" },
    ...clients.map((c) => ({
      value: c.id,
      label: c.company ? `${c.name} (${c.company})` : c.name,
    })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TASK_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handlePresetChange(preset)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              currentPreset === preset
                ? "bg-primary text-white hover:bg-primary/80"
                : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
            }`}
          >
            {TASK_PRESET_LABELS[preset]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Select
          label="Client"
          value={searchParams.get("clientId") ?? ""}
          onChange={(e) => updateParam("clientId", e.target.value)}
          options={clientOptions}
        />
      </div>
      <CategoryFilter />
    </div>
  )
}
