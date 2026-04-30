"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

export interface TaskDTO {
  id: string
  linearIssueId: string
  linearIdentifier: string
  title: string
  status: "BACKLOG" | "IN_PROGRESS" | "PENDING_INVOICE" | "DONE" | "CANCELED"
  priority: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  estimate: number | null
  completedAt: string | null
  invoiceId: string | null
  clientId: string
  projectId: string
}

export function useTasks(filters?: {
  clientId?: string
  projectId?: string
  status?: string
}) {
  const qs = new URLSearchParams()
  if (filters?.clientId) qs.set("clientId", filters.clientId)
  if (filters?.projectId) qs.set("projectId", filters.projectId)
  if (filters?.status) qs.set("status", filters.status)
  const search = qs.toString()
  return useQuery({
    queryKey: ["tasks", filters ?? {}] as const,
    queryFn: () =>
      api.get<{ items: TaskDTO[] }>(`/api/tasks${search ? `?${search}` : ""}`),
    select: (d) => d.items,
    staleTime: 30_000,
  })
}

export function useSyncLinear() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      api.post<{ projects: number; tasks: number }>("/api/linear/refresh"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["projects"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
    },
  })
}
