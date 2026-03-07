import { z } from "zod/v4"

import { categoryFilterField } from "./category-filter"

export const TASK_PRESETS = [
  "active",
  "all",
  "done",
  "to-invoice",
  "backlog",
] as const

export type TaskPreset = (typeof TASK_PRESETS)[number]

export const TASK_PRESET_LABELS: Record<TaskPreset, string> = {
  active: "Active",
  all: "All",
  done: "Done",
  "to-invoice": "To Invoice",
  backlog: "Backlog",
}

export const taskFilterSchema = z.object({
  clientId: z.string().optional(),
  preset: z.enum(TASK_PRESETS).default("active"),
  category: categoryFilterField,
})

export type TaskFilterInput = z.infer<typeof taskFilterSchema>
