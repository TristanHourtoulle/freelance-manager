"use client"

import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { PageToolbar } from "@/components/ui/page-toolbar"
import { TaskFilters, type TaskView } from "@/components/tasks/task-filters"
import { TaskGroupList } from "@/components/tasks/task-group-list"
import { TaskKpiCards } from "@/components/tasks/task-kpi-cards"
import { TaskKanbanBoard } from "@/components/tasks/kanban/task-kanban-board"
import { TaskEmptyState } from "@/components/tasks/task-empty-state"
import { SyncStatusBar } from "@/components/ui/sync-status-bar"
import { useToast } from "@/components/providers/toast-provider"
import { useTasks, useRefreshLinear } from "@/hooks/use-tasks"

import type { ClientSummary, KanbanTask } from "@/components/tasks/types"

export default function TasksPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [view, setView] = useState<TaskView>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("tasks-view") as TaskView) || "list"
    }
    return "list"
  })

  const { data, isLoading, isFetching } = useTasks(searchParams.toString())

  const refreshMutation = useRefreshLinear()

  const groups = data?.groups ?? []
  const lastSyncedAt = data?.lastSyncedAt ?? null
  const isStale = data?.isStale ?? false

  const handleViewChange = useCallback((newView: TaskView) => {
    setView(newView)
    localStorage.setItem("tasks-view", newView)
  }, [])

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

  const handleStatusChange = useCallback(
    async (
      linearIssueId: string,
      _newStatusName: string,
      newStatusId: string,
    ) => {
      const res = await fetch(`/api/linear/issues/${linearIssueId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateId: newStatusId }),
      })

      if (res.ok) {
        toast({ variant: "success", title: "Status updated" })
      } else {
        toast({ variant: "error", title: "Failed to update status" })
      }
    },
    [toast],
  )

  const allClients: ClientSummary[] = groups.map((g) => g.client)
  const hasFilters = Boolean(
    searchParams.get("clientId") || searchParams.get("preset"),
  )

  const kanbanTasks: KanbanTask[] = useMemo(
    () =>
      groups.flatMap((g) =>
        g.tasks.map((t) => ({
          ...t,
          clientName: g.client.company
            ? `${g.client.name} (${g.client.company})`
            : g.client.name,
        })),
      ),
    [groups],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks">
        <Link href="/tasks/new">
          <Button>New Task</Button>
        </Link>
        <Link href="/billing">
          <Button variant="outline">To Invoice</Button>
        </Link>
      </PageHeader>

      <PageToolbar>
        <SyncStatusBar
          lastSyncedAt={lastSyncedAt}
          isStale={isStale}
          onRefresh={handleRefresh}
          isRefreshing={isLoading || isFetching}
        />
        <TaskFilters
          clients={allClients}
          view={view}
          onViewChange={handleViewChange}
        />
      </PageToolbar>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : groups.length === 0 ? (
        <TaskEmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <TaskKpiCards groups={groups} />

          {view === "list" ? (
            <TaskGroupList
              groups={groups}
              onToggleToInvoice={handleToggleToInvoice}
              onToggleInvoiced={handleToggleInvoiced}
              onUpdateEstimate={handleUpdateEstimate}
              onUpdateRate={handleUpdateRate}
            />
          ) : (
            <TaskKanbanBoard
              tasks={kanbanTasks}
              onStatusChange={handleStatusChange}
            />
          )}
        </>
      )}
    </div>
  )
}
