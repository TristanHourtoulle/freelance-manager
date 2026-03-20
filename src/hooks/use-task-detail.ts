"use client"

import { useQuery } from "@tanstack/react-query"

import type { TaskDetailResponse } from "@/components/tasks/types"

/**
 * Fetches a single Linear issue detail. Cached for 1 minute.
 */
export function useTaskDetail(linearIssueId: string) {
  return useQuery<TaskDetailResponse>({
    queryKey: ["task-detail", linearIssueId],
    queryFn: async () => {
      const res = await fetch(`/api/linear/issues/${linearIssueId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? "Failed to load task")
      }
      return res.json()
    },
    staleTime: 1 * 60 * 1000,
    enabled: !!linearIssueId,
  })
}
