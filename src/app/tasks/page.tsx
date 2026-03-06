"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TaskFilters } from "@/components/tasks/task-filters"
import { TaskGroupList } from "@/components/tasks/task-group-list"
import { TaskEmptyState } from "@/components/tasks/task-empty-state"

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
      }
      if (!cancelled) setIsLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [searchParams, refreshKey])

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

  const allClients: ClientSummary[] = groups.map((g) => g.client)
  const hasFilters = Boolean(
    searchParams.get("clientId") || searchParams.get("status"),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Tasks
        </h1>
        <Link href="/billing">
          <Button variant="secondary">To Invoice</Button>
        </Link>
      </div>

      <TaskFilters clients={allClients} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Loading tasks...
          </p>
        </div>
      ) : groups.length === 0 ? (
        <TaskEmptyState hasFilters={hasFilters} />
      ) : (
        <TaskGroupList
          groups={groups}
          onToggleToInvoice={handleToggleToInvoice}
          onToggleInvoiced={handleToggleInvoiced}
        />
      )}
    </div>
  )
}
