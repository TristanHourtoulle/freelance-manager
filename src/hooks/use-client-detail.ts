"use client"

import { useQuery } from "@tanstack/react-query"

interface RevenueDataPoint {
  month: string
  label: string
  amount: number
}

interface RecentInvoice {
  id: string
  month: string
  totalAmount: number
  status: string
  paymentDueDate: string | null
  createdAt: string
}

interface RecentExpense {
  id: string
  description: string
  amount: number
  date: string
  category: string
}

export interface ClientDashboardData {
  client: {
    id: string
    name: string
    company: string | null
    category: string
    billingMode: string
    rate: number
    createdAt: string
    logo: string | null
  }
  stats: {
    totalRevenue: number
    totalInvoices: number
    totalTasks: number
    invoicedTasks: number
    pendingTasks: number
    totalExpenses: number
  }
  revenueByMonth: RevenueDataPoint[]
  recentInvoices: RecentInvoice[]
  recentExpenses: RecentExpense[]
}

/**
 * Fetches a single client's dashboard data. Cached for 2 minutes.
 * Only fetches when clientId is truthy.
 */
export function useClientDashboard(clientId: string) {
  return useQuery<ClientDashboardData>({
    queryKey: ["client-dashboard", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/dashboard`)
      if (!res.ok) throw new Error("Failed to load client dashboard")
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
    enabled: !!clientId,
  })
}
