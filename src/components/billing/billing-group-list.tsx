"use client"

import { useState } from "react"
import { TaskTable } from "@/components/tasks/task-table"

import type { ClientTaskGroup } from "@/components/tasks/types"

interface BillingGroupListProps {
  groups: ClientTaskGroup[]
  selectedIds: Set<string>
  onToggleTask: (linearIssueId: string) => void
  onToggleGroup: (clientId: string, linearIssueIds: string[]) => void
}

const BILLING_MODE_LABELS: Record<string, string> = {
  HOURLY: "Hourly",
  DAILY: "Daily",
  FIXED: "Fixed",
  FREE: "Free",
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

export function BillingGroupList({
  groups,
  selectedIds,
  onToggleTask,
  onToggleGroup,
}: BillingGroupListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleCollapse(clientId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.client.id)
        const groupIssueIds = group.tasks.map((t) => t.linearIssueId)
        const allSelected = groupIssueIds.every((id) => selectedIds.has(id))
        const someSelected =
          !allSelected && groupIssueIds.some((id) => selectedIds.has(id))

        return (
          <div
            key={group.client.id}
            className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected
                }}
                onChange={() => onToggleGroup(group.client.id, groupIssueIds)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <button
                onClick={() => toggleCollapse(group.client.id)}
                className="flex flex-1 items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className={`h-4 w-4 text-zinc-400 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {group.client.name}
                    </span>
                    {group.client.company && (
                      <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {group.client.company}
                      </span>
                    )}
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {BILLING_MODE_LABELS[group.client.billingMode] ??
                      group.client.billingMode}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {group.taskCount} task{group.taskCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatAmount(group.totalBilling)}
                </div>
              </button>
            </div>

            {!isCollapsed && (
              <div className="border-t border-zinc-100 dark:border-zinc-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-200 dark:border-zinc-700">
                        <th className="w-10 px-3 py-2" />
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
                      </tr>
                    </thead>
                    <tbody>
                      {group.tasks.map((task) => (
                        <tr
                          key={task.linearIssueId}
                          className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                        >
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(task.linearIssueId)}
                              onChange={() => onToggleTask(task.linearIssueId)}
                              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            {task.url ? (
                              <a
                                href={task.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                              >
                                {task.identifier}
                              </a>
                            ) : (
                              <span className="text-sm text-zinc-400">
                                {task.identifier}
                              </span>
                            )}
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
                            {task.estimate !== undefined
                              ? `${task.estimate}h`
                              : "-"}
                          </td>
                          <td
                            className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100"
                            title={task.billingFormula}
                          >
                            {formatAmount(task.billingAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
