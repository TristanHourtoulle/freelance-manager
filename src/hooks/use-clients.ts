"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import type { ClientCreateInput, ClientUpdateInput } from "@/lib/schemas/client"
import type { PaginatedResponse } from "@/lib/schemas/pagination"
import type { ClientWireRow } from "@/domain/clients/types"

export type { ClientWireRow } from "@/domain/clients/types"
export type ClientDTO = ClientWireRow

export function useClients() {
  return useInfiniteQuery({
    queryKey: qk.clients(),
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<ClientDTO>>(
        `/api/clients?limit=50${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: STALE_TIME.hour,
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
