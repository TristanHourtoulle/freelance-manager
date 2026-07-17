"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

export interface TaskDTO {
  id: string
  linearIssueId: string
  linearIdentifier: string
  title: string
  status: "BACKLOG" | "IN_PROGRESS" | "PENDING_INVOICE" | "DONE" | "CANCELED"
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  estimate: number | null
  completedAt: string | null
  invoiceId: string | null
  clientId: string
  projectId: string
}

interface TaskFilters {
  clientId?: string
  projectId?: string
  status?: string
}

const EMPTY_TASK_FILTERS: TaskFilters = {}

export function useTasks(filters: TaskFilters = EMPTY_TASK_FILTERS) {
  const baseQs = new URLSearchParams()
  if (filters.clientId) baseQs.set("clientId", filters.clientId)
  if (filters.projectId) baseQs.set("projectId", filters.projectId)
  if (filters.status) baseQs.set("status", filters.status)
  baseQs.set("limit", "50")
  return useInfiniteQuery({
    queryKey: ["tasks", filters] as const,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams(baseQs)
      if (pageParam) qs.set("cursor", pageParam)
      return api.get<PaginatedResponse<TaskDTO>>(`/api/tasks?${qs.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: 30_000,
  })
}

export function useSyncLinear() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: () =>
      api.post<{ projects: number; tasks: number }>("/api/linear/refresh"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["projects"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      router.refresh()
    },
  })
}
