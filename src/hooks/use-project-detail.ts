"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"
import type { ProjectUpdateInput } from "@/lib/schemas/project"

export interface ProjectDetailTaskDTO {
  id: string
  linearIdentifier: string
  linearUrl: string | null
  title: string
  status: "BACKLOG" | "IN_PROGRESS" | "PENDING_INVOICE" | "DONE" | "CANCELED"
  estimate: number | null
  invoiceId: string | null
}

export interface ProjectDetailInvoiceDTO {
  id: string
  number: string
  status: "DRAFT" | "SENT" | "CANCELLED"
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERPAID"
  isOverdue: boolean
  kind: "STANDARD" | "DEPOSIT"
  issueDate: string
  dueDate: string
  paidAmount: number
  balanceDue: number
  total: number
  linesCount: number
}

export interface ProjectDetailDTO {
  id: string
  name: string
  key: string
  description: string | null
  status: "ACTIVE" | "PAUSED" | "COMPLETED"
  linearProjectId: string
  linearTeamId: string | null
  lastSyncedAt: string
  repoUrl: string | null
  stagingUrl: string | null
  prodUrl: string | null
  runbook: string | null
  client: {
    id: string
    firstName: string
    lastName: string
    company: string | null
    color: string | null
    billingMode: "DAILY" | "FIXED" | "HOURLY"
    rate: number
  }
  tasks: ProjectDetailTaskDTO[]
  invoices: ProjectDetailInvoiceDTO[]
  counts: {
    tasksTotal: number
    tasksPendingInvoice: number
    invoicesTotal: number
  }
  totals: {
    revenue: number
    outstanding: number
  }
}

/**
 * Reads the full detail payload of one mirrored Linear project.
 *
 * @param id - The local project id; the query stays disabled while falsy.
 * @returns The TanStack query for {@link ProjectDetailDTO}.
 */
export function useProjectDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.project.detail(id),
    queryFn: () => api.get<ProjectDetailDTO>(`/api/projects/${id}`),
    enabled: Boolean(id),
    staleTime: STALE_TIME.detail,
  })
}

/**
 * Persists the app-owned workspace fields of a project.
 *
 * @param id - The local project id to patch.
 * @returns A mutation invalidating the project detail and list caches.
 */
export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (input: ProjectUpdateInput) =>
      api.patch<{ ok: true }>(`/api/projects/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.project.detail(id) })
      qc.invalidateQueries({ queryKey: qk.projects() })
      toast({
        variant: "success",
        title: "Projet enregistré",
        description: "Les informations du projet sont à jour.",
      })
    },
    onError: (e) =>
      toast({
        variant: "error",
        title: "Erreur",
        description: e instanceof Error ? e.message : String(e),
      }),
  })
}
