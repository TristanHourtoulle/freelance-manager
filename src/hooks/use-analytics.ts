"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

export type AnalyticsRange = "3m" | "6m" | "12m"

export interface AnalyticsDTO {
  range: AnalyticsRange
  months: { label: string; paid: number; issued: number; isCurrent: boolean }[]
  kpi: {
    totalRevenue: number
    avgRevenue: number
    trend: number
    paidCount: number
    avgDelay: number
    avgInvoice: number
    conversion: number
    runRate: number
  }
  byClient: {
    client: {
      id: string
      firstName: string
      lastName: string
      company: string | null
      color: string | null
    }
    revenue: number
  }[]
  byType: { type: "DAILY" | "FIXED" | "HOURLY"; revenue: number }[]
  weeks: { label: string; done: number; invoiced: number }[]
  heatmap: number[][]
}

export function useAnalytics(range: AnalyticsRange) {
  return useQuery({
    queryKey: ["analytics", range] as const,
    queryFn: () => api.get<AnalyticsDTO>(`/api/analytics?range=${range}`),
    staleTime: 60_000,
  })
}
