"use client"

import { useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageToolbar } from "@/components/ui/page-toolbar"
import { TaskFilters } from "@/components/tasks/task-filters"
import { TaskGroupList } from "@/components/tasks/task-group-list"
import { TaskEmptyState } from "@/components/tasks/task-empty-state"
import { SyncStatusBar } from "@/components/ui/sync-status-bar"
import { TooltipHint } from "@/components/ui/tooltip-hint"
import { useToast } from "@/components/providers/toast-provider"
import { useTasks, useRefreshLinear } from "@/hooks/use-tasks"

import type { ClientSummary } from "@/components/tasks/types"

export default function TasksPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const { data, isLoading, isFetching } = useTasks(searchParams.toString())

  const refreshMutation = useRefreshLinear()

  const groups = data?.groups ?? []
  const lastSyncedAt = data?.lastSyncedAt ?? null
  const isStale = data?.isStale ?? false

  const handleRefresh = useCallback(async () => {
    refreshMutation.mutate()
  }, [refreshMutation])

  const updateOverride = useCallback(
    async (
      clientId: string,
      linearIssueId: string,
      payload: Record<string, unknown>,
    ) => {
      const res = await fetch(`/api/tasks/${linearIssueId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, ...payload }),
      })

      if (!res.ok) {
        toast({ variant: "error", title: "Failed to update task" })
      }
    },
    [toast],
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

  const handleUpdateEstimate = useCallback(
    async (clientId: string, linearIssueId: string, estimate: number) => {
      const res = await fetch(`/api/linear/issues/${linearIssueId}/estimate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimate }),
      })

      if (!res.ok) {
        toast({ variant: "error", title: "Failed to update estimate" })
      }
    },
    [toast],
  )

  const handleUpdateRate = useCallback(
    async (clientId: string, linearIssueId: string, rate: number | null) => {
      const res = await fetch(`/api/tasks/${linearIssueId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, rateOverride: rate }),
      })

      if (!res.ok) {
        toast({ variant: "error", title: "Failed to update rate" })
      }
    },
    [toast],
  )

  const allClients: ClientSummary[] = groups.map((g) => g.client)
  const hasFilters = Boolean(
    searchParams.get("clientId") || searchParams.get("preset"),
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks">
        <Link href="/tasks/new">
          <Button>New Task</Button>
        </Link>
        <Link href="/billing">
          <Button variant="secondary">To Invoice</Button>
        </Link>
      </PageHeader>

      <TooltipHint storageKey="tasks-page">
        Your Linear tasks appear here grouped by client. Use the sync button to
        refresh data from Linear.
      </TooltipHint>

      <PageToolbar>
        <SyncStatusBar
          lastSyncedAt={lastSyncedAt}
          isStale={isStale}
          onRefresh={handleRefresh}
          isRefreshing={isLoading || isFetching}
        />
        <TaskFilters clients={allClients} />
      </PageToolbar>

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
