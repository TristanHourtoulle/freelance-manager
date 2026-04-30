"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

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
  return useQuery({
    queryKey: ["linear-mappings"] as const,
    queryFn: () =>
      api.get<{ items: AllMappingsItem[] }>("/api/linear-mappings"),
    select: (d) => d.items,
    staleTime: 30_000,
    enabled,
  })
}

/** Lists all Linear projects accessible with the user's token. */
export function useLinearProjects(enabled = true) {
  return useQuery({
    queryKey: ["linear-projects"] as const,
    queryFn: () =>
      api.get<{ items: LinearProjectDTO[] }>("/api/linear/projects"),
    select: (d) => d.items,
    staleTime: 60_000,
    enabled,
  })
}

export function useClientLinearMappings(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-linear-mappings", clientId] as const,
    queryFn: () =>
      api.get<{ items: LinearMappingDTO[] }>(
        `/api/clients/${clientId}/linear-mappings`,
      ),
    select: (d) => d.items,
    enabled: Boolean(clientId),
    staleTime: 30_000,
  })
}

export function useAddLinearMapping(clientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (linearProjectId: string) =>
      api.post(`/api/clients/${clientId}/linear-mappings`, {
        linearProjectId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["client-linear-mappings", clientId],
      })
      qc.invalidateQueries({ queryKey: ["linear-mappings"] })
      qc.invalidateQueries({ queryKey: ["client", clientId] })
      qc.invalidateQueries({ queryKey: ["projects"] })
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
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
        queryKey: ["client-linear-mappings", clientId],
      })
      qc.invalidateQueries({ queryKey: ["linear-mappings"] })
      qc.invalidateQueries({ queryKey: ["client", clientId] })
    },
  })
}
