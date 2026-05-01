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
  billingMode: "DAILY" | "FIXED" | "HOURLY"
  rate: number
  fixedPrice: number | null
  deposit: number | null
  paymentTerms: number | null
  category: "FREELANCE" | "STUDY" | "PERSONAL" | "SIDE_PROJECT"
  color: string | null
  archived: boolean
  createdAt: string
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

export function useClientDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: ["client", id] as const,
    queryFn: () => api.get<ClientDetailDTO>(`/api/clients/${id}`),
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}
