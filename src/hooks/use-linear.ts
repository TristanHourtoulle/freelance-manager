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
import type { PaginatedResponse } from "@/lib/schemas/pagination"

export interface LinearProjectDTO {
  id: string
  name: string
  description: string | null
}

export interface LinearMappingDTO {
  id: string
  clientId: string
  linearTeamId: string | null
  linearProjectId: string | null
  createdAt: string
}

export interface AllMappingsItem {
  id: string
  clientId: string
  clientLabel: string
  linearTeamId: string | null
  linearProjectId: string | null
}

/** Lists ALL Linear mappings of the current user, across every client. */
export function useAllLinearMappings(enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.linear.mappings(),
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<AllMappingsItem>>(
        `/api/linear-mappings?limit=50${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: STALE_TIME.list,
    enabled,
  })
}

/** Lists all Linear projects accessible with the user's token. */
export function useLinearProjects(enabled = true) {
  return useQuery({
    queryKey: qk.linear.projects(),
    queryFn: () =>
      api.get<{ items: LinearProjectDTO[] }>("/api/linear/projects"),
    select: (d) => d.items,
    staleTime: STALE_TIME.hour,
    enabled,
  })
}

export function useClientLinearMappings(clientId: string | null | undefined) {
  return useQuery({
    queryKey: qk.linear.clientMappings.detail(clientId),
    queryFn: () =>
      api.get<{ items: LinearMappingDTO[] }>(
        `/api/clients/${clientId}/linear-mappings`,
      ),
    select: (d) => d.items,
    enabled: Boolean(clientId),
    staleTime: STALE_TIME.list,
  })
}

export function useAddLinearMapping(clientId: string) {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (linearProjectId: string) =>
      api.post(`/api/clients/${clientId}/linear-mappings`, {
        linearProjectId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.linear.clientMappings.detail(clientId),
      })
      qc.invalidateQueries({ queryKey: qk.linear.mappings() })
      qc.invalidateQueries({ queryKey: qk.client.detail(clientId) })
      qc.invalidateQueries({ queryKey: qk.projects() })
      qc.invalidateQueries({ queryKey: qk.tasks.all() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      router.refresh()
    },
  })
}

export function useRemoveLinearMapping(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mappingId: string) =>
      api.delete(`/api/clients/${clientId}/linear-mappings/${mappingId}`),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.linear.clientMappings.detail(clientId),
      })
      qc.invalidateQueries({ queryKey: qk.linear.mappings() })
      qc.invalidateQueries({ queryKey: qk.client.detail(clientId) })
    },
  })
}
