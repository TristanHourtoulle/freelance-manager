"use client"

import { useState, useRef, useCallback } from "react"

import type { EnrichedTask } from "./types"

interface TaskRowProps {
  task: EnrichedTask
  onToggleToInvoice?: (linearIssueId: string, value: boolean) => void
  onToggleInvoiced?: (linearIssueId: string, value: boolean) => void
  onUpdateEstimate?: (linearIssueId: string, estimate: number) => void
}

function formatEstimate(estimate: number | undefined): string {
  if (estimate === undefined) return "-"
  return `${estimate}h`
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

export function TaskRow({
  task,
  onToggleToInvoice,
  onToggleInvoiced,
  onUpdateEstimate,
}: TaskRowProps) {
  const [isEditingEstimate, setIsEditingEstimate] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const startEditing = useCallback(() => {
    if (!onUpdateEstimate) return
    setEditValue(task.estimate !== undefined ? String(task.estimate) : "")
    setIsEditingEstimate(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }, [onUpdateEstimate, task.estimate])

  const cancelEditing = useCallback(() => {
    setIsEditingEstimate(false)
  }, [])

  const submitEstimate = useCallback(() => {
    setIsEditingEstimate(false)
    const parsed = parseInt(editValue, 10)
    if (isNaN(parsed) || parsed < 0) return
    if (parsed === task.estimate) return
    onUpdateEstimate?.(task.linearIssueId, parsed)
  }, [editValue, task.estimate, task.linearIssueId, onUpdateEstimate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        submitEstimate()
      } else if (e.key === "Escape") {
        cancelEditing()
      }
    },
    [submitEstimate, cancelEditing],
  )

  return (
    <tr className="border-b border-border-light last:border-0">
      {onToggleToInvoice && (
        <td className="px-3 py-2.5">
          <input
            type="checkbox"
            checked={task.toInvoice}
            onChange={(e) =>
              onToggleToInvoice(task.linearIssueId, e.target.checked)
            }
            className="h-4 w-4 rounded border-border-input text-primary focus:ring-primary"
          />
        </td>
      )}
      <td className="px-3 py-2.5">
        <a
          href={task.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-text-secondary hover:text-primary"
        >
          {task.identifier}
        </a>
      </td>
      <td className="max-w-xs truncate px-3 py-2.5 text-sm text-text-primary">
        {task.title}
      </td>
      <td className="px-3 py-2.5">
        {task.status ? (
          <span
            className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${task.status.color}18`,
              color: task.status.color,
              borderColor: `${task.status.color}40`,
            }}
          >
            {task.status.name}
          </span>
        ) : (
          <span className="text-xs text-text-muted">-</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary">
        {isEditingEstimate ? (
          <input
            ref={inputRef}
            type="number"
            min={0}
            max={100}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={submitEstimate}
            onKeyDown={handleKeyDown}
            className="w-16 rounded border border-border-input bg-surface px-1.5 py-0.5 text-right text-sm tabular-nums text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            onClick={startEditing}
            disabled={!onUpdateEstimate}
            className={
              onUpdateEstimate
                ? "cursor-pointer rounded px-1.5 py-0.5 hover:bg-surface-muted"
                : ""
            }
          >
            {formatEstimate(task.estimate)}
          </button>
        )}
      </td>
      <td
        className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-text-primary"
        title={task.billingFormula}
      >
        {formatAmount(task.billingAmount)}
      </td>
      {onToggleInvoiced && (
        <td className="px-3 py-2.5 text-center">
          {task.invoiced ? (
            <button
              onClick={() => onToggleInvoiced(task.linearIssueId, false)}
              className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200"
            >
              Invoiced
            </button>
          ) : (
            <button
              onClick={() => onToggleInvoiced(task.linearIssueId, true)}
              className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-border"
            >
              Not invoiced
            </button>
          )}
        </td>
      )}
    </tr>
  )
}
