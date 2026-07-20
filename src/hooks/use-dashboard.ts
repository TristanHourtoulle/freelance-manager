"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"

export interface DashboardDTO {
  kpi: {
    revenueMonth: number
    revenueYear: number
    paidCount: number
    paidCountMonth: number
    paidCountYear: number
    outstanding: number
    sentCount: number
    overdueAmount: number
    overdueCount: number
    pipelineCount: number
    pipelineEur: number
    pipelineClientCount: number
  }
  capacity: {
    days: number
    taskCount: number
    estimatedTaskCount: number
    missingEstimateCount: number
    workingDaysPerWeek: number
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
    status: "DRAFT" | "SENT" | "CANCELLED"
    paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERPAID"
    isOverdue: boolean
    issueDate: string
    total: number
    balanceDue: number
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
    linearUrl: string | null
    title: string
    status: "BACKLOG" | "IN_PROGRESS" | "PENDING_INVOICE" | "DONE" | "CANCELED"
    projectKey: string | null
  }[]
  inProgress: {
    count: number
    top: {
      id: string
      linearIdentifier: string
      linearUrl: string | null
      title: string
      projectKey: string | null
    }[]
  }
  lastSync: string | null
}

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard(),
    queryFn: () => api.get<DashboardDTO>("/api/dashboard"),
    staleTime: STALE_TIME.detail,
    refetchOnWindowFocus: false,
  })
}
