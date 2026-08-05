"use client"

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"
import type { PaginatedResponse } from "@/lib/schemas/pagination"
import type { TaskCountsQuery, TaskCountsSummary } from "@/domain/tasks/counts"
import { useTriggerTaskSync } from "@/hooks/use-task-sync"

export type { TaskCountsQuery, TaskCountsSummary } from "@/domain/tasks/counts"

export type NonBillableReason =
  | "BUG_FIX_ALREADY_INVOICED"
  | "NON_BILLED_WORK"
  | "COMMERCIAL_GESTURE"
  | "OTHER"

export interface TaskDTO {
  id: string
  linearIssueId: string
  linearIdentifier: string
  linearUrl: string | null
  title: string
  status: "BACKLOG" | "IN_PROGRESS" | "PENDING_INVOICE" | "DONE" | "CANCELED"
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  estimate: number | null
  actualDays: number | null
  completedAt: string | null
  invoiceId: string | null
  taskGroupId?: string | null
  clientId: string
  projectId: string
  billable: boolean
  nonBillableReason: NonBillableReason | null
  nonBillableNote: string | null
}

export interface TaskBillabilityPayload {
  billable: boolean
  nonBillableReason: NonBillableReason | null
  nonBillableNote: string | null
}

interface TaskFilters {
  clientIds?: string[]
  projectIds?: string[]
  status?: string
  billable?: boolean
}

const EMPTY_TASK_FILTERS: TaskFilters = {}

interface UseTasksOptions {
  enabled?: boolean
}

const DEFAULT_TASK_OPTIONS: UseTasksOptions = {}

function normalizeIds(ids: string[] | undefined): string[] | undefined {
  if (!ids || ids.length === 0) return undefined
  return [...new Set(ids)].sort()
}

/**
 * Paginated task list for the given filters.
 *
 * `clientIds` / `projectIds` are multi-select narrowings sent to the API as
 * comma-separated params. They are deduped and sorted before entering the
 * query key, so two equivalent selections share one cache entry, and an empty
 * array means "no narrowing".
 *
 * When the selection changes, the previous results are kept on screen as
 * placeholder data (`isPlaceholderData` flips true) so the list never
 * collapses to a skeleton on refetch.
 *
 * @param filters - Optional client / project / status / billable narrowing.
 * @param options - `enabled` (default `true`) gates the network request.
 */
export function useTasks(
  filters: TaskFilters = EMPTY_TASK_FILTERS,
  { enabled = true }: UseTasksOptions = DEFAULT_TASK_OPTIONS,
) {
  const clientIds = normalizeIds(filters.clientIds)
  const projectIds = normalizeIds(filters.projectIds)
  const normalized: TaskFilters = {
    ...(clientIds ? { clientIds } : {}),
    ...(projectIds ? { projectIds } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.billable !== undefined ? { billable: filters.billable } : {}),
  }
  const baseQs = new URLSearchParams()
  if (clientIds) baseQs.set("clientIds", clientIds.join(","))
  if (projectIds) baseQs.set("projectIds", projectIds.join(","))
  if (normalized.status) baseQs.set("status", normalized.status)
  if (normalized.billable !== undefined)
    baseQs.set("billable", String(normalized.billable))
  baseQs.set("limit", "50")
  return useInfiniteQuery({
    enabled,
    queryKey: qk.tasks.list(normalized),
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams(baseQs)
      if (pageParam) qs.set("cursor", pageParam)
      return api.get<PaginatedResponse<TaskDTO>>(`/api/tasks?${qs.toString()}`)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.list,
  })
}

const EMPTY_COUNT_FILTERS: TaskCountsQuery = {}

/**
 * Uncapped Tasks-page chip counts, computed server-side.
 *
 * Hits `GET /api/tasks?summary=status`, so every figure covers the full task
 * table instead of the 50-row pages {@link useTasks} has scrolled in. The key
 * nests under the `["tasks", …]` prefix, so every mutation invalidating
 * `qk.tasks.all()` (billability, effort, sync) refreshes these counts too.
 *
 * `clientIds` / `projectIds` are multi-select narrowings sent to the API as
 * comma-separated params, deduped and sorted before entering the query key so
 * two equivalent selections share one cache entry. An empty array means "no
 * narrowing".
 *
 * @param filters - Optional client / project multi-select narrowing matching
 *   the page filters, forwarded to the server so the chips stay truthful.
 * @param options - `enabled` (default `true`) gates the network request.
 * @returns A query resolving to {@link TaskCountsSummary}.
 */
export function useTaskCounts(
  filters: TaskCountsQuery = EMPTY_COUNT_FILTERS,
  { enabled = true }: UseTasksOptions = DEFAULT_TASK_OPTIONS,
) {
  const clientIds = normalizeIds(filters.clientIds)
  const projectIds = normalizeIds(filters.projectIds)
  const normalized: TaskCountsQuery = {
    ...(clientIds ? { clientIds } : {}),
    ...(projectIds ? { projectIds } : {}),
  }
  const qs = new URLSearchParams({ summary: "status" })
  if (clientIds) qs.set("clientIds", clientIds.join(","))
  if (projectIds) qs.set("projectIds", projectIds.join(","))
  return useQuery({
    enabled,
    queryKey: qk.tasks.counts(normalized),
    queryFn: () => api.get<TaskCountsSummary>(`/api/tasks?${qs.toString()}`),
    placeholderData: keepPreviousData,
    staleTime: STALE_TIME.list,
  })
}

/**
 * Persist the real effort spent on a task, in days.
 *
 * Captured inline on the task row so it is filled at the moment the task flips
 * to `PENDING_INVOICE`. Invalidates the task list plus every aggregate that
 * consumes the effort denominator (analytics effective rate, dashboard).
 */
export function useUpdateTaskEffort() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({
      id,
      actualDays,
    }: {
      id: string
      actualDays: number | null
    }) => api.patch<TaskDTO>(`/api/tasks/${id}`, { actualDays }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tasks.all() })
      qc.invalidateQueries({ queryKey: qk.analyticsAll() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      qc.invalidateQueries({ queryKey: qk.taskGroups.all() })
    },
    onError: (e) => {
      toast({
        variant: "error",
        title: "Temps réel non enregistré",
        description: e instanceof Error ? e.message : String(e),
      })
    },
  })
}

function invalidateBillabilityGraph(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: qk.tasks.all() })
  qc.invalidateQueries({ queryKey: qk.analyticsAll() })
  qc.invalidateQueries({ queryKey: qk.dashboard() })
  qc.invalidateQueries({ queryKey: [...qk.clients(), "billable"] })
}

/**
 * Mark one task billable or non-billable, with the structured reason.
 *
 * Server roundtrip only (no optimistic update — this is money-adjacent).
 * Invalidates the task lists plus every aggregate consuming the pipeline:
 * analytics, dashboard and the clients billable summary ("À facturer").
 */
export function useSetTaskBillability() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: ({
      id,
      ...billability
    }: { id: string } & TaskBillabilityPayload) =>
      api.patch<TaskDTO>(`/api/tasks/${id}`, { billability }),
    onSuccess: (task) => {
      invalidateBillabilityGraph(qc)
      toast({
        variant: "success",
        title: task.billable
          ? "Tâche remise en facturation"
          : "Tâche exclue de la facturation",
      })
    },
    onError: (e) => {
      toast({
        variant: "error",
        title: "Facturabilité non enregistrée",
        description: e instanceof Error ? e.message : String(e),
      })
    },
  })
}

/**
 * Mark a batch of tasks billable or non-billable in one call.
 *
 * Same invalidation surface as {@link useSetTaskBillability}; the success
 * toast reports the number of rows actually updated by the server.
 */
export function useBulkSetTaskBillability() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (input: { taskIds: string[] } & TaskBillabilityPayload) =>
      api.post<{ updated: number }>("/api/tasks/billability", input),
    onSuccess: (result, variables) => {
      invalidateBillabilityGraph(qc)
      toast({
        variant: "success",
        title: variables.billable
          ? "Tâches remises en facturation"
          : "Tâches exclues de la facturation",
        description: `${result.updated} tâche${result.updated > 1 ? "s" : ""} mise${result.updated > 1 ? "s" : ""} à jour.`,
      })
    },
    onError: (e) => {
      toast({
        variant: "error",
        title: "Facturabilité non enregistrée",
        description: e instanceof Error ? e.message : String(e),
      })
    },
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
  return useTriggerTaskSync({ providerId: "linear", displayName: "Linear" })
}
