"use client"

import { useState, useRef, useCallback } from "react"
import Link from "next/link"
import { XMarkIcon } from "@heroicons/react/20/solid"

import type { EnrichedTask } from "./types"

interface TaskRowProps {
  task: EnrichedTask
  clientRate?: number
  billingMode?: string
  onToggleToInvoice?: (linearIssueId: string, value: boolean) => void
  onToggleInvoiced?: (linearIssueId: string, value: boolean) => void
  onUpdateEstimate?: (linearIssueId: string, estimate: number) => void
  onUpdateRate?: (linearIssueId: string, rate: number | null) => void
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
  clientRate,
  billingMode,
  onToggleToInvoice,
  onToggleInvoiced,
  onUpdateEstimate,
  onUpdateRate,
}: TaskRowProps) {
  const [isEditingEstimate, setIsEditingEstimate] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const [isEditingRate, setIsEditingRate] = useState(false)
  const [rateEditValue, setRateEditValue] = useState("")
  const rateInputRef = useRef<HTMLInputElement>(null)

  const showRateColumn = billingMode === "HOURLY" || billingMode === "DAILY"

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

  const startEditingRate = useCallback(() => {
    if (!onUpdateRate || clientRate === undefined) return
    const currentRate = task.rateOverride ?? clientRate
    setRateEditValue(String(currentRate))
    setIsEditingRate(true)
    setTimeout(() => rateInputRef.current?.select(), 0)
  }, [onUpdateRate, clientRate, task.rateOverride])

  const cancelEditingRate = useCallback(() => {
    setIsEditingRate(false)
  }, [])

  const submitRate = useCallback(() => {
    setIsEditingRate(false)
    const parsed = parseFloat(rateEditValue)
    if (isNaN(parsed) || parsed < 0) return
    const currentRate = task.rateOverride ?? clientRate
    if (parsed === currentRate) return
    const newRate = parsed === clientRate ? null : parsed
    onUpdateRate?.(task.linearIssueId, newRate)
  }, [
    rateEditValue,
    task.rateOverride,
    task.linearIssueId,
    clientRate,
    onUpdateRate,
  ])

  const handleRateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        submitRate()
      } else if (e.key === "Escape") {
        cancelEditingRate()
      }
    },
    [submitRate, cancelEditingRate],
  )

  const resetRate = useCallback(() => {
    onUpdateRate?.(task.linearIssueId, null)
  }, [onUpdateRate, task.linearIssueId])

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
        <Link
          href={`/tasks/${task.linearIssueId}`}
          className="text-sm font-medium text-text-secondary hover:text-primary"
        >
          {task.identifier}
        </Link>
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
      {showRateColumn && (
        <td className="px-3 py-2.5 text-right text-sm tabular-nums">
          {isEditingRate ? (
            <input
              ref={rateInputRef}
              type="number"
              step="0.01"
              min={0}
              value={rateEditValue}
              onChange={(e) => setRateEditValue(e.target.value)}
              onBlur={submitRate}
              onKeyDown={handleRateKeyDown}
              className="w-20 rounded border border-border-input bg-surface px-1.5 py-0.5 text-right text-sm tabular-nums text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : task.rateOverride !== null ? (
            <span className="inline-flex items-center gap-1">
              <button
                onClick={startEditingRate}
                className="cursor-pointer rounded px-1.5 py-0.5 font-medium text-amber-600 hover:bg-surface-muted"
                title={`Overridden (default: ${clientRate} EUR)`}
              >
                {task.rateOverride}
              </button>
              <button
                onClick={resetRate}
                title="Reset to client default"
                className="rounded p-0.5 text-text-muted hover:text-red-500"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <button
              onClick={startEditingRate}
              disabled={!onUpdateRate}
              className={
                onUpdateRate
                  ? "cursor-pointer rounded px-1.5 py-0.5 text-text-secondary hover:bg-surface-muted"
                  : "text-text-secondary"
              }
            >
              {clientRate}
            </button>
          )}
        </td>
      )}
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
