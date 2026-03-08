"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import type { TasksApiResponse } from "@/components/tasks/types"

/**
 * Fetches tasks with filters, grouped by client. Cached for 2 minutes.
 */
export function useTasks(searchParams: string) {
  return useQuery<TasksApiResponse>({
    queryKey: ["tasks", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?${searchParams}`)
      if (!res.ok) throw new Error("Failed to fetch tasks")
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Refreshes Linear data and invalidates task cache.
 */
export function useRefreshLinear() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/linear/refresh", { method: "POST" })
      if (!res.ok) throw new Error("Failed to refresh")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

/**
 * Updates a task override (toInvoice, invoiced, rateOverride).
 */
export function useUpdateTaskOverride() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      linearIssueId,
      clientId,
      payload,
    }: {
      linearIssueId: string
      clientId: string
      payload: Record<string, unknown>
    }) => {
      const res = await fetch(`/api/tasks/${linearIssueId}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, ...payload }),
      })
      if (!res.ok) throw new Error("Failed to update override")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["billing"] })
    },
  })
}

/**
 * Updates a task's workflow status in Linear.
 */
export function useUpdateTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      linearIssueId,
      stateId,
    }: {
      linearIssueId: string
      stateId: string
    }) => {
      const res = await fetch(`/api/linear/issues/${linearIssueId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateId }),
      })
      if (!res.ok) throw new Error("Failed to update status")
    },
    // No onSuccess invalidation -- the caller handles optimistic updates.
    // Immediate refetch would race with Linear's propagation delay and
    // overwrite the optimistic data with stale server state.
  })
}

/**
 * Updates a task estimate in Linear.
 */
export function useUpdateEstimate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      linearIssueId,
      estimate,
    }: {
      linearIssueId: string
      estimate: number
    }) => {
      const res = await fetch(`/api/linear/issues/${linearIssueId}/estimate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimate }),
      })
      if (!res.ok) throw new Error("Failed to update estimate")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}
