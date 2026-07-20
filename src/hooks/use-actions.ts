"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

export type ClientActionType = "RELANCE" | "LINK" | "RDV" | "OTHER"
export type ClientActionStatus = "TODO" | "DONE"

export interface ActionClientRef {
  id: string
  firstName: string
  lastName: string
  company: string | null
  color: string | null
}

export interface ActionDTO {
  id: string
  clientId: string
  client: ActionClientRef
  type: ClientActionType
  title: string
  link: string | null
  notes: string | null
  status: ClientActionStatus
  dueDate: string | null
  doneAt: string | null
  invoiceId: string | null
  invoiceNumber: string | null
  meetingId: string | null
  createdAt: string
}

export interface ActionCreateBody {
  clientId: string
  type?: ClientActionType
  title: string
  link?: string | null
  notes?: string | null
  dueDate?: string | null
  invoiceId?: string | null
  meetingId?: string | null
}

export interface ActionUpdateBody {
  type?: ClientActionType
  title?: string
  link?: string | null
  notes?: string | null
  status?: ClientActionStatus
  dueDate?: string | null
  invoiceId?: string | null
  meetingId?: string | null
}

export interface RelanceResponse {
  action: ActionDTO | null
  created: boolean
  settled: boolean
}

export interface RelanceVariables {
  invoiceId: string
  clientId: string
}

interface ActionFilters {
  clientId?: string
  status?: ClientActionStatus
  type?: ClientActionType
}

const EMPTY_FILTERS: ActionFilters = {}

export function useActions(filters: ActionFilters = EMPTY_FILTERS) {
  const baseQs = new URLSearchParams()
  if (filters.clientId) baseQs.set("clientId", filters.clientId)
  if (filters.status) baseQs.set("status", filters.status)
  if (filters.type) baseQs.set("type", filters.type)
  baseQs.set("limit", "50")
  return useInfiniteQuery({
    queryKey: qk.actions.list(filters),
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams(baseQs)
      if (pageParam) qs.set("cursor", pageParam)
      return api.get<PaginatedResponse<ActionDTO>>(
        `/api/actions?${qs.toString()}`,
      )
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: STALE_TIME.list,
  })
}

function invalidateAction(
  qc: ReturnType<typeof useQueryClient>,
  clientId?: string,
) {
  qc.invalidateQueries({ queryKey: qk.actions.all() })
  qc.invalidateQueries({ queryKey: qk.dashboard() })
  if (clientId) qc.invalidateQueries({ queryKey: qk.client.detail(clientId) })
}

export function useCreateAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ActionCreateBody) =>
      api.post<ActionDTO>("/api/actions", input),
    onSuccess: (_d, input) => invalidateAction(qc, input.clientId),
  })
}

/**
 * Queue the RELANCE follow-up action of an overdue invoice.
 *
 * Idempotent server-side: calling it twice returns the existing action with
 * `created: false`. An already-settled invoice answers `settled: true` with a
 * null action instead of an error, so callers must branch on the flag rather
 * than on a rejection.
 */
export function useRelanceInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId }: RelanceVariables) =>
      api.post<RelanceResponse>(`/api/invoices/${invoiceId}/relance`),
    onSuccess: (data, variables) => {
      if (!data.created) return
      invalidateAction(qc, variables.clientId)
    },
  })
}

export function useUpdateAction(clientId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActionUpdateBody }) =>
      api.patch<ActionDTO>(`/api/actions/${id}`, input),
    onSuccess: () => invalidateAction(qc, clientId),
  })
}

export function useDeleteAction(clientId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/actions/${id}`),
    onSuccess: () => invalidateAction(qc, clientId),
  })
}
