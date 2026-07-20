"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import type { ClientCreateInput, ClientUpdateInput } from "@/lib/schemas/client"
import type { PaginatedResponse } from "@/lib/schemas/pagination"
import type { ClientWireRow } from "@/domain/clients/types"
import type { ClientsBillableSummary } from "@/domain/clients/billable"

export type { ClientWireRow } from "@/domain/clients/types"
export type { ClientsBillableSummary } from "@/domain/clients/billable"
export type ClientDTO = ClientWireRow

interface UseClientsOptions {
  archived?: boolean
}

/**
 * Paginated client list. Active clients by default; pass `archived` to read
 * the archived set instead (distinct query key so the two never collide).
 *
 * @param options - `archived` switches the list to archived clients.
 */
export function useClients({ archived = false }: UseClientsOptions = {}) {
  return useInfiniteQuery({
    queryKey: archived ? [...qk.clients(), "archived"] : qk.clients(),
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<ClientDTO>>(
        `/api/clients?limit=50${archived ? "&archived=true" : ""}${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: STALE_TIME.hour,
  })
}

/**
 * Global "à facturer" aggregate, computed server-side over every task.
 *
 * Kept out of {@link useClients} on purpose: that list is paginated and cached
 * for an hour, which would silently cap and stale the counts. Own key under the
 * `clients` prefix so client mutations still invalidate it.
 */
export function useClientsBillable() {
  return useQuery({
    queryKey: [...qk.clients(), "billable"],
    queryFn: () =>
      api.get<ClientsBillableSummary>("/api/clients?summary=billable"),
    staleTime: STALE_TIME.list,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (input: ClientCreateInput) =>
      api.post<ClientDTO>("/api/clients", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients() })
      router.refresh()
    },
  })
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientUpdateInput) =>
      api.patch(`/api/clients/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients() })
      qc.invalidateQueries({ queryKey: qk.client.detail(id) })
      qc.invalidateQueries({ queryKey: qk.client.activity(id) })
    },
  })
}

export function useArchiveClient() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/clients/${id}/archive`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: qk.clients() })
      qc.invalidateQueries({ queryKey: qk.client.detail(id) })
      router.refresh()
    },
  })
}

export function useDuplicateClient() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ id: string }>(`/api/clients/${id}/duplicate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients() })
      router.refresh()
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/clients/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: qk.clients() })
      qc.invalidateQueries({ queryKey: qk.client.detail(id) })
      router.refresh()
    },
  })
}
