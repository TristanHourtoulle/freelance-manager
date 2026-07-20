"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { api, isApiErrorWithStatus } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"
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

interface UseTasksOptions {
  enabled?: boolean
}

const DEFAULT_TASK_OPTIONS: UseTasksOptions = {}

/**
 * Paginated task list for the given filters.
 *
 * @param filters - Optional client / project / status narrowing.
 * @param options - `enabled` (default `true`) gates the network request.
 */
export function useTasks(
  filters: TaskFilters = EMPTY_TASK_FILTERS,
  { enabled = true }: UseTasksOptions = DEFAULT_TASK_OPTIONS,
) {
  const baseQs = new URLSearchParams()
  if (filters.clientId) baseQs.set("clientId", filters.clientId)
  if (filters.projectId) baseQs.set("projectId", filters.projectId)
  if (filters.status) baseQs.set("status", filters.status)
  baseQs.set("limit", "50")
  return useInfiniteQuery({
    enabled,
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
 * The server answers 202 before the pull even starts, so this mutation only
 * reports that the run was accepted. Completion is owned by
 * `useLinearSyncWatcher`, which polls the run row and handles the invalidation
 * and the result toast. Invalidating the sync-status key here makes the first
 * poll immediate instead of waiting for the idle tick.
 */
export function useSyncLinear() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: () =>
      api.post<{ status: string; runId: string }>("/api/linear/refresh"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.linear.syncStatus() })
      toast({
        variant: "success",
        title: "Synchronisation Linear lancée…",
        description: "Les résultats apparaîtront dans quelques instants.",
      })
    },
    onError: (e) => {
      if (isApiErrorWithStatus(e, 409)) {
        qc.invalidateQueries({ queryKey: qk.linear.syncStatus() })
        toast({
          variant: "info",
          title: "Synchronisation déjà en cours",
          description: "Patiente qu'elle se termine avant d'en relancer une.",
        })
        return
      }
      toast({
        variant: "error",
        title: "Sync échouée",
        description: e instanceof Error ? e.message : String(e),
      })
    },
  })
}
