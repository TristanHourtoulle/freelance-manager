"use client"

import type { EnrichedTask } from "./types"

interface TaskRowProps {
  task: EnrichedTask
  onToggleToInvoice?: (linearIssueId: string, value: boolean) => void
  onToggleInvoiced?: (linearIssueId: string, value: boolean) => void
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
}: TaskRowProps) {
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
        {formatEstimate(task.estimate)}
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
