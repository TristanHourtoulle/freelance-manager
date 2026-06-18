"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

export interface ClientDetailDTO {
  id: string
  firstName: string
  lastName: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  billingMode: "DAILY" | "FIXED" | "HOURLY"
  rate: number
  fixedPrice: number | null
  deposit: number | null
  paymentTerms: number | null
  category: "FREELANCE" | "STUDY" | "PERSONAL" | "SIDE_PROJECT"
  color: string | null
  starred: boolean
  archived: boolean
  createdAt: string
  monthlyRevenue: { month: string; total: number }[]
  projects: {
    id: string
    name: string
    key: string
    description: string | null
    status: "ACTIVE" | "PAUSED" | "COMPLETED"
    linearProjectId: string
  }[]
  linearMappings: {
    id: string
    linearTeamId: string | null
    linearProjectId: string | null
  }[]
  tasks: {
    id: string
    linearIdentifier: string
    title: string
    status: "BACKLOG" | "IN_PROGRESS" | "PENDING_INVOICE" | "DONE" | "CANCELED"
    estimate: number | null
    projectId: string
    invoiceId: string | null
  }[]
  invoices: {
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
  }[]
}

export type ActivityKind =
  | "CLIENT_CREATED"
  | "CLIENT_UPDATED"
  | "CLIENT_ARCHIVED"
  | "CLIENT_DUPLICATED"
  | "INVOICE_CREATED"
  | "INVOICE_SENT"
  | "INVOICE_CANCELLED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_DELETED"
  | "TASKS_PENDING"
  | "LINEAR_SYNCED"

export interface ActivityItemDTO {
  id: string
  kind: ActivityKind
  title: string
  meta: string | null
  createdAt: string
  invoiceId: string | null
  projectId: string | null
}

export function useClientDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: ["client", id] as const,
    queryFn: () => api.get<ClientDetailDTO>(`/api/clients/${id}`),
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}

export function useClientActivity(id: string | null | undefined) {
  return useQuery({
    queryKey: ["client-activity", id] as const,
    queryFn: () =>
      api.get<{ items: ActivityItemDTO[] }>(`/api/clients/${id}/activity`),
    select: (d) => d.items,
    enabled: Boolean(id),
    staleTime: 30_000,
  })
}
