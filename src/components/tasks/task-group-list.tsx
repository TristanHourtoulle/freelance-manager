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
  onUpdateEstimate: (
    clientId: string,
    linearIssueId: string,
    estimate: number,
  ) => void
  onUpdateRate: (
    clientId: string,
    linearIssueId: string,
    rate: number | null,
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

/**
 * Collapsible accordion of task groups organized by client.
 * Each group expands to a TaskTable with inline editing for estimates, rates, and invoicing.
 * Used on the tasks page.
 */
export function TaskGroupList({
  groups,
  onToggleToInvoice,
  onToggleInvoiced,
  onUpdateEstimate,
  onUpdateRate,
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
            className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
          >
            <button
              onClick={() => toggleCollapse(group.client.id)}
              className="flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-surface-muted/50"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
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
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    {group.client.name}
                  </span>
                  {group.client.company && (
                    <span className="text-sm text-text-secondary">
                      {group.client.company}
                    </span>
                  )}
                </div>
                <span className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
                  {BILLING_MODE_LABELS[group.client.billingMode] ??
                    group.client.billingMode}
                </span>
                <span className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs font-medium text-text-secondary">
                  {group.taskCount} task{group.taskCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="text-sm font-semibold tabular-nums text-text-primary">
                {formatAmount(group.totalBilling)}
              </div>
            </button>

            {!isCollapsed && (
              <div className="border-t border-border-light">
                <TaskTable
                  tasks={group.tasks}
                  clientRate={group.client.rate}
                  billingMode={group.client.billingMode}
                  onToggleToInvoice={(issueId, value) =>
                    onToggleToInvoice(group.client.id, issueId, value)
                  }
                  onToggleInvoiced={(issueId, value) =>
                    onToggleInvoiced(group.client.id, issueId, value)
                  }
                  onUpdateEstimate={(issueId, estimate) =>
                    onUpdateEstimate(group.client.id, issueId, estimate)
                  }
                  onUpdateRate={(issueId, rate) =>
                    onUpdateRate(group.client.id, issueId, rate)
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
