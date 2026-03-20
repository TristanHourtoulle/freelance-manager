"use client"

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query"

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
    placeholderData: keepPreviousData,
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
 * Updates a task override (toInvoice, invoiced, rateOverride) with optimistic update.
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
    onMutate: async ({ linearIssueId, payload }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] })
      const previousQueries = queryClient.getQueriesData<TasksApiResponse>({
        queryKey: ["tasks"],
      })

      queryClient.setQueriesData<TasksApiResponse>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            groups: old.groups.map((group) => ({
              ...group,
              tasks: group.tasks.map((task) =>
                task.linearIssueId === linearIssueId
                  ? {
                      ...task,
                      ...(payload.toInvoice !== undefined
                        ? { toInvoice: payload.toInvoice as boolean }
                        : {}),
                      ...(payload.invoiced !== undefined
                        ? { invoiced: payload.invoiced as boolean }
                        : {}),
                    }
                  : task,
              ),
            })),
          }
        },
      )

      return { previousQueries }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["billing"] })
    },
  })
}

/**
 * Updates a task's workflow status in Linear with optimistic update.
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
      newStatus?: { id: string; name: string; type: string; color: string }
    }) => {
      const res = await fetch(`/api/linear/issues/${linearIssueId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateId }),
      })
      if (!res.ok) throw new Error("Failed to update status")
    },
    onMutate: async ({ linearIssueId, newStatus }) => {
      if (!newStatus) return

      await queryClient.cancelQueries({ queryKey: ["tasks"] })
      const previousQueries = queryClient.getQueriesData<TasksApiResponse>({
        queryKey: ["tasks"],
      })

      queryClient.setQueriesData<TasksApiResponse>(
        { queryKey: ["tasks"] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            groups: old.groups.map((group) => ({
              ...group,
              tasks: group.tasks.map((task) =>
                task.linearIssueId === linearIssueId
                  ? { ...task, status: newStatus }
                  : task,
              ),
            })),
          }
        },
      )

      return { previousQueries }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    // Delay invalidation to let Linear propagate the change
    onSettled: () => {
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] })
      }, 3000)
    },
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
