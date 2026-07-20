"use client"

import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import type { ConcentrationSummary } from "@/domain/analytics/concentration"
import type { AccuracyResult } from "@/domain/analytics/estimate-accuracy"
import type { CategoryMix } from "@/domain/analytics/category-mix"

export type { AccuracyResult } from "@/domain/analytics/estimate-accuracy"
export type {
  CategoryMix,
  CategoryMixRow,
  ClientCategoryKey,
} from "@/domain/analytics/category-mix"

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
    revenueShare: number | null
    daysShare: number | null
  }[]
  byType: { type: "DAILY" | "FIXED" | "HOURLY"; revenue: number }[]
  weeks: { label: string; done: number; invoiced: number }[]
  heatmap: number[][]
  concentration: Omit<ConcentrationSummary, "rows">
  estimateAccuracy: {
    overall: AccuracyResult
    byBillingMode: Record<"DAILY" | "FIXED" | "HOURLY", AccuracyResult>
    byClient: Record<string, AccuracyResult>
  }
  categoryMix: CategoryMix
}

export function useAnalytics(range: AnalyticsRange) {
  return useQuery({
    queryKey: qk.analytics(range),
    queryFn: () => api.get<AnalyticsDTO>(`/api/analytics?range=${range}`),
    staleTime: STALE_TIME.detail,
    refetchOnWindowFocus: false,
  })
}
