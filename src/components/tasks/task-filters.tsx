"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { ListBulletIcon, ViewColumnsIcon } from "@heroicons/react/24/outline"
import { Chip } from "@/components/ui/chip-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"
import { TASK_PRESETS, type TaskPreset } from "@/lib/schemas/task"

import type { ClientSummary } from "./types"

export type TaskView = "list" | "kanban"

interface TaskFiltersProps {
  clients: ClientSummary[]
  view: TaskView
  onViewChange: (view: TaskView) => void
}

const CATEGORY_VALUES = [
  "FREELANCE",
  "STUDY",
  "PERSONAL",
  "SIDE_PROJECT",
] as const

const CATEGORY_KEYS: Record<string, string> = {
  FREELANCE: "freelance",
  STUDY: "study",
  PERSONAL: "personal",
  SIDE_PROJECT: "sideProject",
}

const PRESET_KEYS: Record<TaskPreset, string> = {
  active: "active",
  all: "all",
  done: "done",
  "to-invoice": "toInvoice",
  backlog: "backlog",
}

export function TaskFilters({ clients, view, onViewChange }: TaskFiltersProps) {
  const t = useTranslations("tasks")
  const tc = useTranslations("common")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  usePersistedFilters("tasks", ["preset", "clientId", "category"])

  const currentPreset: TaskPreset =
    (searchParams.get("preset") as TaskPreset) ?? "active"

  const selectedCategories = searchParams.get("category")?.split(",") ?? []

  const clientId = searchParams.get("clientId") ?? ""

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

  function handleCategoryToggle(value: string) {
    const next = selectedCategories.includes(value)
      ? selectedCategories.filter((v) => v !== value)
      : [...selectedCategories, value]
    const params = new URLSearchParams(searchParams.toString())
    if (next.length > 0) {
      params.set("category", next.join(","))
    } else {
      params.delete("category")
    }
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Preset tabs row */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          {TASK_PRESETS.map((preset, index) => (
            <Chip
              key={preset}
              label={t(`presets.${PRESET_KEYS[preset]}`)}
              isActive={currentPreset === preset}
              onClick={() => handlePresetChange(preset)}
              position={
                index === 0
                  ? "first"
                  : index === TASK_PRESETS.length - 1
                    ? "last"
                    : "middle"
              }
            />
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

      {/* Category chips + Client dropdown on the same row (Figma layout) */}
      <div className="flex flex-wrap items-stretch gap-2.5">
        {CATEGORY_VALUES.map((value, index) => (
          <Chip
            key={value}
            label={tc(`categories.${CATEGORY_KEYS[value]}`)}
            isActive={selectedCategories.includes(value)}
            onClick={() => handleCategoryToggle(value)}
            position={index === 0 ? "first" : "middle"}
          />
        ))}
        <Select
          value={clientId || "__all__"}
          onValueChange={(val) =>
            updateParam("clientId", val === "__all__" ? "" : (val ?? ""))
          }
        >
          <SelectTrigger
            className="h-auto w-auto border-border bg-transparent px-3.5 py-1.5 text-xs font-medium text-text-secondary"
            style={{ borderRadius: "12px 19px 19px 12px" }}
          >
            <span>
              {clientId
                ? (() => {
                    const c = clients.find((cl) => cl.id === clientId)
                    return c
                      ? c.company
                        ? `${c.name} (${c.company})`
                        : c.name
                      : t("allClients")
                  })()
                : t("allClients")}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allClients")}</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.company ? `${c.name} (${c.company})` : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
