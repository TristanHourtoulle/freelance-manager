"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

const SYNC_SETTLE_DELAY_MS = 2500

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
    queryKey: qk.tasks.list(filters),
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams(baseQs)
      if (pageParam) qs.set("cursor", pageParam)
      return api.get<PaginatedResponse<TaskDTO>>(`/api/tasks?${qs.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: STALE_TIME.list,
  })
}

/**
 * Trigger a Linear sync.
 *
 * The server now runs the pull off the request thread and answers 202
 * immediately, so no counts come back. We toast that the sync started, then
 * — after a short bounded delay for the background job to settle — invalidate
 * the affected queries and `router.refresh()` the RSC tree (nav badges).
 * Success and error toasts are centralized here so every call site behaves
 * consistently.
 */
export function useSyncLinear() {
  const qc = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  return useMutation({
    mutationFn: () => api.post<{ status: string }>("/api/linear/refresh"),
    onSuccess: () => {
      toast({
        variant: "success",
        title: "Synchronisation Linear lancée…",
        description: "Les résultats apparaîtront dans quelques instants.",
      })
      window.setTimeout(() => {
        qc.invalidateQueries({ queryKey: qk.tasks.all() })
        qc.invalidateQueries({ queryKey: qk.projects() })
        qc.invalidateQueries({ queryKey: qk.dashboard() })
        router.refresh()
      }, SYNC_SETTLE_DELAY_MS)
    },
    onError: (e) =>
      toast({
        variant: "error",
        title: "Sync échouée",
        description: e instanceof Error ? e.message : String(e),
      }),
  })
}
