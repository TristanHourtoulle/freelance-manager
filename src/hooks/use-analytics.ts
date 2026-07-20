"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"

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
    collectionRate: number
    winRate: number
    avgDecisionDays: number
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
    days: number
    effectiveRate: number | null
  }[]
  byType: { type: "DAILY" | "FIXED" | "HOURLY"; revenue: number }[]
  weeks: { label: string; done: number; invoiced: number }[]
  heatmap: number[][]
}

export function useAnalytics(range: AnalyticsRange) {
  return useQuery({
    queryKey: qk.analytics(range),
    queryFn: () => api.get<AnalyticsDTO>(`/api/analytics?range=${range}`),
    staleTime: STALE_TIME.detail,
    refetchOnWindowFocus: false,
  })
}
