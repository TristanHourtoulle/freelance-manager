"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { PaginatedResponse } from "@/lib/schemas/pagination"

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
  return useInfiniteQuery({
    queryKey: ["projects"] as const,
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<ProjectDTO>>(
        `/api/projects?limit=50${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: 60 * 60_000,
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
