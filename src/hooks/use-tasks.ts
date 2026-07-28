"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import { api, isApiErrorWithStatus } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

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
  clientId?: string
  projectId?: string
  status?: string
  billable?: boolean
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
  if (filters.billable !== undefined)
    baseQs.set("billable", String(filters.billable))
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
