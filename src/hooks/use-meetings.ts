"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import type { PaginatedResponse } from "@/lib/schemas/pagination"
import type { ActionClientRef } from "@/hooks/use-actions"

export interface MeetingDTO {
  id: string
  clientId: string
  client: ActionClientRef
  title: string
  teamsUrl: string | null
  heldAt: string
  durationMinutes: number
  participants: string[]
  agendaMd: string | null
  summaryMd: string | null
  actionsCount: number
  createdAt: string
}

export interface MeetingCreateBody {
  clientId: string
  title: string
  teamsUrl?: string | null
  heldAt: string
  durationMinutes?: number
  participants?: string[]
  agendaMd?: string | null
  summaryMd?: string | null
}

export interface MeetingUpdateBody {
  title?: string
  teamsUrl?: string | null
  heldAt?: string
  durationMinutes?: number
  participants?: string[]
  agendaMd?: string | null
  summaryMd?: string | null
}

interface MeetingFilters {
  clientId?: string
}

const EMPTY_FILTERS: MeetingFilters = {}

export function useMeetings(filters: MeetingFilters = EMPTY_FILTERS) {
  const baseQs = new URLSearchParams()
  if (filters.clientId) baseQs.set("clientId", filters.clientId)
  baseQs.set("limit", "50")
  return useInfiniteQuery({
    queryKey: qk.meetings.list(filters),
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams(baseQs)
      if (pageParam) qs.set("cursor", pageParam)
      return api.get<PaginatedResponse<MeetingDTO>>(
        `/api/meetings?${qs.toString()}`,
      )
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: STALE_TIME.list,
  })
}

function invalidateMeeting(
  qc: ReturnType<typeof useQueryClient>,
  clientId?: string,
) {
  qc.invalidateQueries({ queryKey: qk.meetings.all() })
  qc.invalidateQueries({ queryKey: qk.actions.all() })
  qc.invalidateQueries({ queryKey: qk.dashboard() })
  if (clientId) qc.invalidateQueries({ queryKey: qk.client.detail(clientId) })
}

export function useCreateMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MeetingCreateBody) =>
      api.post<MeetingDTO>("/api/meetings", input),
    onSuccess: (_d, input) => invalidateMeeting(qc, input.clientId),
  })
}

export function useUpdateMeeting(clientId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MeetingUpdateBody }) =>
      api.patch<MeetingDTO>(`/api/meetings/${id}`, input),
    onSuccess: () => invalidateMeeting(qc, clientId),
  })
}

export function useDeleteMeeting(clientId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/meetings/${id}`),
    onSuccess: () => invalidateMeeting(qc, clientId),
  })
}
