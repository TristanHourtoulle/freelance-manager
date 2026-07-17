"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
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
    queryKey: qk.projects(),
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<ProjectDTO>>(
        `/api/projects?limit=50${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: STALE_TIME.hour,
  })
}

/**
 * Deletes (unlinks) a project.
 *
 * @remarks
 * The mutation only receives a `projectId`, and the delete endpoint returns no
 * client id, so the affected client cannot be targeted precisely. All cached
 * client-detail views are therefore invalidated deliberately via
 * `qk.client.all()` (they render the project's tasks and project list); the
 * previous untyped `["client"]` prefix is replaced by this explicit accessor.
 */
export function useDeleteProject() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (projectId: string) => api.delete(`/api/projects/${projectId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.projects() })
      qc.invalidateQueries({ queryKey: qk.tasks.all() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      router.refresh()
      qc.invalidateQueries({ queryKey: qk.client.all() })
      qc.invalidateQueries({ queryKey: qk.linear.clientMappings.all() })
      qc.invalidateQueries({ queryKey: qk.linear.mappings() })
    },
  })
}
