"use client"

import { useState, type CSSProperties } from "react"
import { useUpdateTaskEffort } from "@/hooks/use-tasks"

interface TaskEffortInputProps {
  taskId: string
  actualDays: number | null
  className?: string
  style?: CSSProperties
  disabled?: boolean
}

function parseDays(raw: string): number | null | undefined {
  const trimmed = raw.trim()
  if (trimmed === "") return null
  const parsed = Number(trimmed.replace(",", "."))
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9999.99)
    return undefined
  return parsed
}

/**
 * Inline capture of the real effort spent on a task, in days.
 *
 * Sits on the task row so the value is entered at the moment the task is
 * reviewed for invoicing. Commits on blur and on Enter; an empty field clears
 * the value back to `null`, and an unparseable one is discarded silently.
 *
 * @param taskId - The task to update.
 * @param actualDays - The persisted effort, or `null` when never captured.
 * @param disabled - Renders the captured value read-only, for rows that can no
 * longer be edited such as already-invoiced tasks.
 */
export function TaskEffortInput({
  taskId,
  actualDays,
  className,
  style,
  disabled = false,
}: TaskEffortInputProps) {
  const update = useUpdateTaskEffort()
  const [draft, setDraft] = useState<string | null>(null)

  const value = draft ?? (actualDays != null ? String(actualDays) : "")

  function commit() {
    if (draft === null) return
    const parsed = parseDays(draft)
    setDraft(null)
    if (parsed === undefined) return
    if (parsed === actualDays) return
    update.mutate({ id: taskId, actualDays: parsed })
  }

  return (
    <input
      className={"input" + (className ? ` ${className}` : "")}
      style={style}
      type="text"
      inputMode="decimal"
      placeholder="—"
      aria-label="Temps réel passé, en jours"
      value={value}
      disabled={disabled || update.isPending}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}
