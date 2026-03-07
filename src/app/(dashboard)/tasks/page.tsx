"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TaskFilters } from "@/components/tasks/task-filters"
import { TaskGroupList } from "@/components/tasks/task-group-list"
import { TaskEmptyState } from "@/components/tasks/task-empty-state"
import { SyncStatusBar } from "@/components/ui/sync-status-bar"

import { calculateBilling } from "@/lib/billing"

import type { BillingMode } from "@/generated/prisma/client"
import type {
  ClientTaskGroup,
  ClientSummary,
  TasksApiResponse,
} from "@/components/tasks/types"

export default function TasksPage() {
  const searchParams = useSearchParams()

  const [groups, setGroups] = useState<ClientTaskGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      const res = await fetch(`/api/tasks?${searchParams.toString()}`, {
        cache: "no-store",
      })
      if (!cancelled && res.ok) {
        const data: TasksApiResponse = await res.json()
        setGroups(data.groups)
        setLastSyncedAt(data.lastSyncedAt)
        setIsStale(data.isStale)
      }
      if (!cancelled) setIsLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [searchParams, refreshKey])

  const handleRefresh = useCallback(async () => {
    await fetch("/api/linear/refresh", { method: "POST" })
    setRefreshKey((k) => k + 1)
  }, [])

  const updateOverride = useCallback(
    async (
      clientId: string,
      linearIssueId: string,
      payload: Record<string, unknown>,
    ) => {
      setGroups((prev) =>
        prev.map((group) => {
          if (group.client.id !== clientId) return group
          return {
            ...group,
            tasks: group.tasks.map((task) => {
              if (task.linearIssueId !== linearIssueId) return task
              return { ...task, ...payload }
            }),
          }
        }),
      )

      const res = await fetch(`/api/tasks/${linearIssueId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, ...payload }),
      })

      if (!res.ok) {
        setRefreshKey((k) => k + 1)
      }
    },
    [],
  )

  const handleToggleToInvoice = useCallback(
    (clientId: string, linearIssueId: string, value: boolean) => {
      updateOverride(clientId, linearIssueId, { toInvoice: value })
    },
    [updateOverride],
  )

  const handleToggleInvoiced = useCallback(
    (clientId: string, linearIssueId: string, value: boolean) => {
      updateOverride(clientId, linearIssueId, { invoiced: value })
    },
    [updateOverride],
  )

  const showError = useCallback((message: string) => {
    setErrorMessage(message)
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 3000)
  }, [])

  const handleUpdateEstimate = useCallback(
    async (clientId: string, linearIssueId: string, estimate: number) => {
      setGroups((prev) =>
        prev.map((group) => {
          if (group.client.id !== clientId) return group
          const updatedTasks = group.tasks.map((task) => {
            if (task.linearIssueId !== linearIssueId) return task
            const billing = calculateBilling({
              billingMode: group.client.billingMode as BillingMode,
              rate: group.client.rate,
              estimate,
              rateOverride: task.rateOverride,
            })
            return {
              ...task,
              estimate,
              billingAmount: billing.amount,
              billingFormula: billing.formula,
            }
          })
          const totalBilling = updatedTasks
            .filter((t) => t.toInvoice)
            .reduce((sum, t) => sum + t.billingAmount, 0)
          return { ...group, tasks: updatedTasks, totalBilling }
        }),
      )

      const res = await fetch(`/api/linear/issues/${linearIssueId}/estimate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimate }),
      })

      if (!res.ok) {
        showError("Failed to update estimate")
        setRefreshKey((k) => k + 1)
      }
    },
    [showError],
  )

  const handleUpdateRate = useCallback(
    async (clientId: string, linearIssueId: string, rate: number | null) => {
      setGroups((prev) =>
        prev.map((group) => {
          if (group.client.id !== clientId) return group
          const updatedTasks = group.tasks.map((task) => {
            if (task.linearIssueId !== linearIssueId) return task
            const billing = calculateBilling({
              billingMode: group.client.billingMode as BillingMode,
              rate: group.client.rate,
              estimate: task.estimate,
              rateOverride: rate,
            })
            return {
              ...task,
              rateOverride: rate,
              billingAmount: billing.amount,
              billingFormula: billing.formula,
            }
          })
          const totalBilling = updatedTasks
            .filter((t) => t.toInvoice)
            .reduce((sum, t) => sum + t.billingAmount, 0)
          return { ...group, tasks: updatedTasks, totalBilling }
        }),
      )

      const res = await fetch(`/api/tasks/${linearIssueId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, rateOverride: rate }),
      })

      if (!res.ok) {
        showError("Failed to update rate")
        setRefreshKey((k) => k + 1)
      }
    },
    [showError],
  )

  const allClients: ClientSummary[] = groups.map((g) => g.client)
  const hasFilters = Boolean(
    searchParams.get("clientId") || searchParams.get("status"),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Tasks</h1>
        <div className="flex gap-3">
          <Link href="/tasks/new">
            <Button>New Task</Button>
          </Link>
          <Link href="/billing">
            <Button variant="secondary">To Invoice</Button>
          </Link>
        </div>
      </div>

      {errorMessage && (
        <button
          onClick={() => setErrorMessage(null)}
          className="flex w-full items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
          <span className="text-xs text-red-400">Dismiss</span>
        </button>
      )}

      <SyncStatusBar
        lastSyncedAt={lastSyncedAt}
        isStale={isStale}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      <TaskFilters clients={allClients} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">Loading tasks...</p>
        </div>
      ) : groups.length === 0 ? (
        <TaskEmptyState hasFilters={hasFilters} />
      ) : (
        <TaskGroupList
          groups={groups}
          onToggleToInvoice={handleToggleToInvoice}
          onToggleInvoiced={handleToggleInvoiced}
          onUpdateEstimate={handleUpdateEstimate}
          onUpdateRate={handleUpdateRate}
        />
      )}
    </div>
  )
}
