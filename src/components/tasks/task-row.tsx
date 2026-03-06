"use client"

import type { EnrichedTask } from "./types"

interface TaskRowProps {
  task: EnrichedTask
  onToggleToInvoice: (linearIssueId: string, value: boolean) => void
  onToggleInvoiced: (linearIssueId: string, value: boolean) => void
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
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
      <td className="px-3 py-2.5">
        <input
          type="checkbox"
          checked={task.toInvoice}
          onChange={(e) =>
            onToggleToInvoice(task.linearIssueId, e.target.checked)
          }
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
        />
      </td>
      <td className="px-3 py-2.5">
        <a
          href={task.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {task.identifier}
        </a>
      </td>
      <td className="max-w-xs truncate px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100">
        {task.title}
      </td>
      <td className="px-3 py-2.5">
        {task.status ? (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${task.status.color}20`,
              color: task.status.color,
            }}
          >
            {task.status.name}
          </span>
        ) : (
          <span className="text-xs text-zinc-400">-</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
        {formatEstimate(task.estimate)}
      </td>
      <td
        className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100"
        title={task.billingFormula}
      >
        {formatAmount(task.billingAmount)}
      </td>
      <td className="px-3 py-2.5 text-center">
        {task.invoiced ? (
          <button
            onClick={() => onToggleInvoiced(task.linearIssueId, false)}
            className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
          >
            Invoiced
          </button>
        ) : (
          <button
            onClick={() => onToggleInvoiced(task.linearIssueId, true)}
            className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          >
            Not invoiced
          </button>
        )}
      </td>
    </tr>
  )
}
