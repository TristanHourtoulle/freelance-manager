"use client"

import { useQuery } from "@tanstack/react-query"
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
