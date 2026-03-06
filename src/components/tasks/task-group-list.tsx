"use client"

import { useState } from "react"
import { TaskTable } from "./task-table"

import type { ClientTaskGroup } from "./types"

interface TaskGroupListProps {
  groups: ClientTaskGroup[]
  onToggleToInvoice: (
    clientId: string,
    linearIssueId: string,
    value: boolean,
  ) => void
  onToggleInvoiced: (
    clientId: string,
    linearIssueId: string,
    value: boolean,
  ) => void
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

export function TaskGroupList({
  groups,
  onToggleToInvoice,
  onToggleInvoiced,
}: TaskGroupListProps) {
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

        return (
          <div
            key={group.client.id}
            className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <button
              onClick={() => toggleCollapse(group.client.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
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

            {!isCollapsed && (
              <div className="border-t border-zinc-100 dark:border-zinc-800">
                <TaskTable
                  tasks={group.tasks}
                  onToggleToInvoice={(issueId, value) =>
                    onToggleToInvoice(group.client.id, issueId, value)
                  }
                  onToggleInvoiced={(issueId, value) =>
                    onToggleInvoiced(group.client.id, issueId, value)
                  }
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
