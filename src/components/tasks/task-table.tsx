"use client"

import { TaskRow } from "./task-row"

import type { EnrichedTask } from "./types"

interface TaskTableProps {
  tasks: EnrichedTask[]
  clientRate?: number
  billingMode?: string
  onToggleToInvoice?: (linearIssueId: string, value: boolean) => void
  onToggleInvoiced?: (linearIssueId: string, value: boolean) => void
  onUpdateEstimate?: (linearIssueId: string, estimate: number) => void
  onUpdateRate?: (linearIssueId: string, rate: number | null) => void
}

export function TaskTable({
  tasks,
  clientRate,
  billingMode,
  onToggleToInvoice,
  onToggleInvoiced,
  onUpdateEstimate,
  onUpdateRate,
}: TaskTableProps) {
  const showRateColumn = billingMode === "HOURLY" || billingMode === "DAILY"
  if (tasks.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-text-secondary">
        No tasks found for this client.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border">
            {onToggleToInvoice && (
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
                Bill
              </th>
            )}
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
              ID
            </th>
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
              Title
            </th>
            <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
              Status
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
              Estimate
            </th>
            {showRateColumn && (
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                Rate
              </th>
            )}
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
              Amount
            </th>
            {onToggleInvoiced && (
              <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
                Invoiced
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow
              key={task.linearIssueId}
              task={task}
              clientRate={clientRate}
              billingMode={billingMode}
              onToggleToInvoice={onToggleToInvoice}
              onToggleInvoiced={onToggleInvoiced}
              onUpdateEstimate={onUpdateEstimate}
              onUpdateRate={onUpdateRate}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
