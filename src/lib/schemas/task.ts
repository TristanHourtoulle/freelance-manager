import { z } from "zod/v4"

import { categoryFilterField } from "./category-filter"

/** Available task filter preset identifiers. */
export const TASK_PRESETS = [
  "active",
  "all",
  "done",
  "to-invoice",
  "backlog",
] as const

export type TaskPreset = (typeof TASK_PRESETS)[number]

/** Human-readable labels for each task preset. */
export const TASK_PRESET_LABELS: Record<TaskPreset, string> = {
  active: "Active",
  all: "All",
  done: "Done",
  "to-invoice": "To Invoice",
  backlog: "Backlog",
}

/** Validates query parameters for the task list endpoint. */
export const taskFilterSchema = z.object({
  clientId: z.string().optional(),
  preset: z.enum(TASK_PRESETS).default("active"),
  category: categoryFilterField,
})

export type TaskFilterInput = z.infer<typeof taskFilterSchema>
