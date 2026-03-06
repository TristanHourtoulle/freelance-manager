"use client"

import { TaskRow } from "./task-row"

import type { EnrichedTask } from "./types"

interface TaskTableProps {
  tasks: EnrichedTask[]
  onToggleToInvoice: (linearIssueId: string, value: boolean) => void
  onToggleInvoiced: (linearIssueId: string, value: boolean) => void
}

export function TaskTable({
  tasks,
  onToggleToInvoice,
  onToggleInvoiced,
}: TaskTableProps) {
  if (tasks.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No tasks found for this client.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Bill
            </th>
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              ID
            </th>
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Title
            </th>
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Status
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Estimate
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Amount
            </th>
            <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Invoiced
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow
              key={task.linearIssueId}
              task={task}
              onToggleToInvoice={onToggleToInvoice}
              onToggleInvoiced={onToggleInvoiced}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
