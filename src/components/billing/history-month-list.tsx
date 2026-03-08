"use client"

import { useState } from "react"

import type { HistoryMonthGroup } from "@/components/billing/types"

interface HistoryMonthListProps {
  months: HistoryMonthGroup[]
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
 * Two-level collapsible list of invoiced tasks grouped first by month, then by client.
 * Each client group expands to show a task detail table.
 * Used on the billing history page.
 */
export function HistoryMonthList({ months }: HistoryMonthListProps) {
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(
    new Set(),
  )

  function toggleMonth(monthKey: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(monthKey)) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })
  }

  function toggleClient(compositeKey: string) {
    setCollapsedClients((prev) => {
      const next = new Set(prev)
      if (next.has(compositeKey)) next.delete(compositeKey)
      else next.add(compositeKey)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {months.map((month) => {
        const isMonthCollapsed = collapsedMonths.has(month.month)

        return (
          <div
            key={month.month}
            className="rounded-lg border border-border bg-surface"
          >
            <button
              onClick={() => toggleMonth(month.month)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`h-4 w-4 text-text-muted transition-transform ${isMonthCollapsed ? "" : "rotate-90"}`}
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
                <h2 className="text-base font-semibold text-text-primary">
                  {month.label}
                </h2>
                <span className="text-sm text-text-secondary">
                  {month.taskCount} task{month.taskCount !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="text-base font-semibold tabular-nums text-text-primary">
                {formatAmount(month.monthTotal)}
              </span>
            </button>

            {!isMonthCollapsed && (
              <div className="space-y-3 border-t border-border-light px-4 py-3">
                {month.clients.map((group) => {
                  const clientKey = `${month.month}-${group.client.id}`
                  const isClientCollapsed = collapsedClients.has(clientKey)

                  return (
                    <div
                      key={group.client.id}
                      className="rounded-md border border-border-light"
                    >
                      <button
                        onClick={() => toggleClient(clientKey)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <svg
                            className={`h-3.5 w-3.5 text-text-muted transition-transform ${isClientCollapsed ? "" : "rotate-90"}`}
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
                            <span className="text-sm font-semibold text-text-primary">
                              {group.client.name}
                            </span>
                            {group.client.company && (
                              <span className="ml-2 text-sm text-text-secondary">
                                {group.client.company}
                              </span>
                            )}
                          </div>
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                            {BILLING_MODE_LABELS[group.client.billingMode] ??
                              group.client.billingMode}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {group.taskCount} task
                            {group.taskCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-text-primary">
                          {formatAmount(group.totalBilling)}
                        </span>
                      </button>

                      {!isClientCollapsed && (
                        <div className="border-t border-border-light">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-border">
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
                                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                                    Amount
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.tasks.map((task) => (
                                  <tr
                                    key={task.linearIssueId}
                                    className="border-b border-border-light last:border-0"
                                  >
                                    <td className="px-3 py-2.5">
                                      {task.url ? (
                                        <a
                                          href={task.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm font-medium text-text-secondary hover:text-primary"
                                        >
                                          {task.identifier}
                                        </a>
                                      ) : (
                                        <span className="text-sm text-text-muted">
                                          {task.identifier}
                                        </span>
                                      )}
                                    </td>
                                    <td className="max-w-xs truncate px-3 py-2.5 text-sm text-text-primary">
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
                                        <span className="text-xs text-text-muted">
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary">
                                      {task.estimate !== undefined
                                        ? `${task.estimate}h`
                                        : "-"}
                                    </td>
                                    <td
                                      className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-text-primary"
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
            )}
          </div>
        )
      })}
    </div>
  )
}
