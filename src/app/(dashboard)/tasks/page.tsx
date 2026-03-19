"use client"

import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { TaskFilters, type TaskView } from "@/components/tasks/task-filters"
import { TaskGroupList } from "@/components/tasks/task-group-list"
import { TaskKpiCards } from "@/components/tasks/task-kpi-cards"
import { TaskKanbanBoard } from "@/components/tasks/kanban/task-kanban-board"
import { TaskEmptyState } from "@/components/tasks/task-empty-state"
import { useToast } from "@/components/providers/toast-provider"
import {
  useTasks,
  useRefreshLinear,
  useUpdateTaskOverride,
  useUpdateEstimate,
  useUpdateTaskStatus,
} from "@/hooks/use-tasks"
import { useHiddenStatuses } from "@/hooks/use-hidden-statuses"

import type {
  ClientSummary,
  KanbanTask,
  TaskStatusDTO,
  TasksApiResponse,
} from "@/components/tasks/types"

export default function TasksPage() {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [view, setView] = useState<TaskView>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("tasks-view") as TaskView) || "list"
    }
    return "list"
  })

  const { data, isLoading, isFetching } = useTasks(searchParams.toString())
  const { hiddenStatusIds, toggleStatus, showAll } = useHiddenStatuses()

  const refreshMutation = useRefreshLinear()

  const rawGroups = data?.groups ?? []

  const groups = useMemo(
    () =>
      rawGroups
        .map((g) => ({
          ...g,
          tasks: g.tasks.filter(
            (t) => !t.status || !hiddenStatusIds.has(t.status.id),
          ),
        }))
        .filter((g) => g.tasks.length > 0),
    [rawGroups, hiddenStatusIds],
  )
  const lastSyncedAt = data?.lastSyncedAt ?? null
  const isStale = data?.isStale ?? false

  const handleViewChange = useCallback((newView: TaskView) => {
    setView(newView)
    localStorage.setItem("tasks-view", newView)
  }, [])

  const handleRefresh = useCallback(async () => {
    refreshMutation.mutate()
  }, [refreshMutation])

  const overrideMutation = useUpdateTaskOverride()
  const estimateMutation = useUpdateEstimate()

  const handleToggleToInvoice = useCallback(
    (clientId: string, linearIssueId: string, value: boolean) => {
      overrideMutation.mutate(
        { linearIssueId, clientId, payload: { toInvoice: value } },
        {
          onError: () =>
            toast({ variant: "error", title: "Failed to update task" }),
        },
      )
    },
    [overrideMutation, toast],
  )

  const handleToggleInvoiced = useCallback(
    (clientId: string, linearIssueId: string, value: boolean) => {
      overrideMutation.mutate(
        { linearIssueId, clientId, payload: { invoiced: value } },
        {
          onError: () =>
            toast({ variant: "error", title: "Failed to update task" }),
        },
      )
    },
    [overrideMutation, toast],
  )

  const handleUpdateEstimate = useCallback(
    (_clientId: string, linearIssueId: string, estimate: number) => {
      estimateMutation.mutate(
        { linearIssueId, estimate },
        {
          onError: () =>
            toast({ variant: "error", title: "Failed to update estimate" }),
        },
      )
    },
    [estimateMutation, toast],
  )

  const handleUpdateRate = useCallback(
    (clientId: string, linearIssueId: string, rate: number | null) => {
      overrideMutation.mutate(
        { linearIssueId, clientId, payload: { rateOverride: rate } },
        {
          onError: () =>
            toast({ variant: "error", title: "Failed to update rate" }),
        },
      )
    },
    [overrideMutation, toast],
  )

  const statusMutation = useUpdateTaskStatus()

  const handleStatusChange = useCallback(
    (linearIssueId: string, newStatus: TaskStatusDTO) => {
      const queryKey = ["tasks", searchParams.toString()]
      const previous = queryClient.getQueryData<TasksApiResponse>(queryKey)

      if (previous) {
        queryClient.setQueryData<TasksApiResponse>(queryKey, {
          ...previous,
          groups: previous.groups.map((g) => ({
            ...g,
            tasks: g.tasks.map((t) =>
              t.linearIssueId === linearIssueId
                ? { ...t, status: newStatus }
                : t,
            ),
          })),
        })
      }

      statusMutation.mutate(
        { linearIssueId, stateId: newStatus.id },
        {
          onError: () => {
            if (previous) {
              queryClient.setQueryData(queryKey, previous)
            }
            toast({ variant: "error", title: "Failed to update status" })
          },
        },
      )
    },
    [searchParams, queryClient, statusMutation, toast],
  )

  const availableStatuses: TaskStatusDTO[] = data?.allStatuses ?? []

  const allClients: ClientSummary[] = data?.allClients ?? []
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
        <Button
          variant="outline"
          shape="pill-left"
          size="lg"
          onClick={handleRefresh}
          disabled={isLoading || isFetching}
        >
          <ArrowPathIcon
            className={`size-4 ${isFetching ? "animate-spin" : ""}`}
          />
          Sync with Linear
        </Button>
        <Link href="/tasks/new">
          <Button variant="gradient" shape="pill-right" size="lg">
            <PlusIcon className="size-4" />
            New Tasks
          </Button>
        </Link>
      </PageHeader>

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

          <TaskFilters
            clients={allClients}
            view={view}
            onViewChange={handleViewChange}
          />

          {view === "list" ? (
            <TaskGroupList
              groups={groups}
              availableStatuses={availableStatuses}
              onToggleToInvoice={handleToggleToInvoice}
              onToggleInvoiced={handleToggleInvoiced}
              onUpdateEstimate={handleUpdateEstimate}
              onUpdateRate={handleUpdateRate}
              onStatusChange={handleStatusChange}
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
