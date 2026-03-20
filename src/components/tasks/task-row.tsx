"use client"

import { useState, useRef, useCallback } from "react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { XMarkIcon } from "@heroicons/react/20/solid"

import { Checkbox } from "@/components/ui/checkbox"
import { TableRow, TableCell } from "@/components/ui/table"

import { TaskStatusBadge } from "./task-status-badge"
import { TaskStatusPicker } from "./task-status-picker"
import type { EnrichedTask, TaskStatusDTO } from "./types"

interface TaskRowProps {
  task: EnrichedTask
  clientRate?: number
  billingMode?: string
  availableStatuses?: TaskStatusDTO[]
  onToggleToInvoice?: (linearIssueId: string, value: boolean) => void
  onToggleInvoiced?: (linearIssueId: string, value: boolean) => void
  onUpdateEstimate?: (linearIssueId: string, estimate: number) => void
  onUpdateRate?: (linearIssueId: string, rate: number | null) => void
  onStatusChange?: (linearIssueId: string, newStatus: TaskStatusDTO) => void
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

/**
 * Single table row for an enriched task with inline-editable estimate and rate fields,
 * billable/invoiced toggles, and a link to the task detail page.
 * Used inside TaskTable.
 */
export function TaskRow({
  task,
  clientRate,
  billingMode,
  availableStatuses,
  onToggleToInvoice,
  onToggleInvoiced,
  onUpdateEstimate,
  onUpdateRate,
  onStatusChange,
}: TaskRowProps) {
  const t = useTranslations("taskTable")
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
    <TableRow className="border-b border-border-light last:border-0">
      {onToggleToInvoice && (
        <TableCell>
          <Checkbox
            checked={task.toInvoice}
            onCheckedChange={(checked) =>
              onToggleToInvoice(task.linearIssueId, !!checked)
            }
          />
        </TableCell>
      )}
      <TableCell>
        <Link
          href={`/tasks/${task.linearIssueId}`}
          className="text-sm font-medium text-text-secondary hover:text-primary"
        >
          {task.identifier}
        </Link>
      </TableCell>
      <TableCell className="max-w-xs truncate text-sm text-text-primary">
        {task.title}
      </TableCell>
      <TableCell className="text-sm text-text-secondary">
        {task.projectName ?? "-"}
      </TableCell>
      <TableCell>
        {task.status && availableStatuses && onStatusChange ? (
          <TaskStatusPicker
            currentStatus={task.status}
            availableStatuses={availableStatuses}
            onStatusChange={(newStatus) =>
              onStatusChange(task.linearIssueId, newStatus)
            }
          />
        ) : task.status ? (
          <TaskStatusBadge status={task.status} />
        ) : (
          <span className="text-xs text-text-muted">-</span>
        )}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums text-text-secondary">
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
      </TableCell>
      {showRateColumn && (
        <TableCell className="text-right text-sm tabular-nums">
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
                className="cursor-pointer rounded px-1.5 py-0.5 font-medium text-amber-600 hover:bg-surface-muted dark:text-amber-400"
                title={t("overriddenRate", { rate: String(clientRate) })}
              >
                {task.rateOverride}
              </button>
              <button
                onClick={resetRate}
                title={t("resetRate")}
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
        </TableCell>
      )}
      <TableCell
        className="text-right text-sm font-medium tabular-nums text-text-primary"
        title={task.billingFormula}
      >
        {formatAmount(task.billingAmount)}
      </TableCell>
      {onToggleInvoiced && (
        <TableCell className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            {task.invoiced ? (
              <button
                onClick={() => onToggleInvoiced(task.linearIssueId, false)}
                className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
              >
                {t("invoiced")}
              </button>
            ) : (
              <button
                onClick={() => onToggleInvoiced(task.linearIssueId, true)}
                className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-border"
              >
                {t("notInvoiced")}
              </button>
            )}
            {task.paid && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                {t("paid")}
              </span>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}
