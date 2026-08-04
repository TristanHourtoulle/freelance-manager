"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import type { TaskGroupDTO } from "@/domain/task-groups/types"
import type {
  TaskGroupCreateInput,
  TaskGroupUpdateInput,
} from "@/lib/schemas/task-group"

export type { TaskGroupDTO, TaskGroupTaskDTO } from "@/domain/task-groups/types"

export function useTaskGroups({
  clientId,
  status = "pending",
  enabled = true,
}: {
  clientId?: string
  status?: "pending" | "invoiced" | "all"
  enabled?: boolean
} = {}) {
  const qs = new URLSearchParams({ status })
  if (clientId) qs.set("clientId", clientId)
  return useQuery({
    enabled,
    queryKey: qk.taskGroups.list(status, clientId),
    queryFn: () => api.get<TaskGroupDTO[]>(`/api/task-groups?${qs.toString()}`),
    staleTime: STALE_TIME.list,
  })
}

function useInvalidateTaskGroups() {
  const qc = useQueryClient()
  const router = useRouter()
  return () => {
    qc.invalidateQueries({ queryKey: qk.taskGroups.all() })
    qc.invalidateQueries({ queryKey: qk.tasks.all() })
    router.refresh()
  }
}

export function useCreateTaskGroup() {
  const invalidate = useInvalidateTaskGroups()
  return useMutation({
    mutationFn: (input: TaskGroupCreateInput) =>
      api.post<TaskGroupDTO>("/api/task-groups", input),
    onSuccess: invalidate,
  })
}

export function useUpdateTaskGroup(id: string) {
  const invalidate = useInvalidateTaskGroups()
  return useMutation({
    mutationFn: (input: TaskGroupUpdateInput) =>
      api.patch(`/api/task-groups/${id}`, input),
    onSuccess: invalidate,
  })
}

export function useDeleteTaskGroup() {
  const invalidate = useInvalidateTaskGroups()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/task-groups/${id}`),
    onSuccess: invalidate,
  })
}
