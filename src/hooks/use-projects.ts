"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

export interface ProjectDTO {
  id: string
  clientId: string
  client: {
    id: string
    firstName: string
    lastName: string
    company: string | null
    color: string | null
  }
  linearProjectId: string
  linearTeamId: string | null
  name: string
  key: string
  description: string | null
  status: "ACTIVE" | "PAUSED" | "COMPLETED"
  tasksTotal: number
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"] as const,
    queryFn: () => api.get<{ items: ProjectDTO[] }>("/api/projects"),
    select: (d) => d.items,
    staleTime: 30_000,
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (projectId: string) => api.delete(`/api/projects/${projectId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] })
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
      qc.invalidateQueries({ queryKey: ["client"] })
      qc.invalidateQueries({ queryKey: ["client-linear-mappings"] })
      qc.invalidateQueries({ queryKey: ["linear-mappings"] })
    },
  })
}
