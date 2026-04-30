"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

export interface DashboardDTO {
  kpi: {
    revenueMonth: number
    revenueYear: number
    paidCount: number
    outstanding: number
    sentCount: number
    overdueAmount: number
    overdueCount: number
    pipelineValue: number
    pipelineCount: number
  }
  months: { month: string; total: number; isCurrent: boolean }[]
  overdue: {
    id: string
    number: string
    clientId: string
    total: number
    dueDate: string
  }[]
  recentInvoices: {
    id: string
    number: string
    kind: "STANDARD" | "DEPOSIT"
    status: "DRAFT" | "SENT" | "PAID" | "OVERDUE"
    issueDate: string
    total: number
    client: {
      firstName: string
      lastName: string
      company: string | null
      color: string | null
    }
  }[]
  recentTasks: {
    id: string
    linearIdentifier: string
    title: string
    status: "BACKLOG" | "IN_PROGRESS" | "PENDING_INVOICE" | "DONE" | "CANCELED"
    projectKey: string | null
  }[]
  lastSync: string | null
}

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"] as const,
    queryFn: () => api.get<DashboardDTO>("/api/dashboard"),
    staleTime: 30_000,
  })
}
