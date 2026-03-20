"use client"

import { useQuery } from "@tanstack/react-query"

import type {
  AnalyticsData,
  RevenueByMonth,
  RevenueByClient,
  HoursByClient,
  RevenueByCategory,
  Utilization,
} from "@/components/analytics/types"

/** Normalizes search params, defaulting period to "3m". */
function normalizeParams(searchParams: string): string {
  const params = new URLSearchParams(searchParams)
  if (!params.has("period")) {
    params.set("period", "3m")
  }
  return params.toString()
}

/** Fetches a specific analytics section from the API. */
async function fetchSection<T>(
  searchParams: string,
  section: string,
): Promise<T> {
  const normalized = normalizeParams(searchParams)
  const res = await fetch(`/api/analytics?${normalized}&section=${section}`)
  if (!res.ok) throw new Error(`Failed to fetch analytics section: ${section}`)
  return res.json()
}

/**
 * Fetches all analytics data at once. Defaults period to "3m" if not specified.
 * Cached for 2 minutes. Kept for backward compatibility.
 */
export function useAnalytics(searchParams: string) {
  const normalizedParams = normalizeParams(searchParams)

  return useQuery<AnalyticsData>({
    queryKey: ["analytics", normalizedParams],
    queryFn: async () => {
      const res = await fetch(`/api/analytics?${normalizedParams}`)
      if (!res.ok) throw new Error("Failed to fetch analytics")
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })
}

/** Fetches only revenue-by-month analytics data. */
export function useRevenueByMonth(searchParams: string) {
  const normalizedParams = normalizeParams(searchParams)

  return useQuery<{ revenueByMonth: RevenueByMonth[] }>({
    queryKey: ["analytics", "revenue-by-month", normalizedParams],
    queryFn: () => fetchSection(searchParams, "revenue-by-month"),
    staleTime: 2 * 60 * 1000,
  })
}

/** Fetches only revenue-by-client analytics data. */
export function useRevenueByClient(searchParams: string) {
  const normalizedParams = normalizeParams(searchParams)

  return useQuery<{ revenueByClient: RevenueByClient[] }>({
    queryKey: ["analytics", "revenue-by-client", normalizedParams],
    queryFn: () => fetchSection(searchParams, "revenue-by-client"),
    staleTime: 2 * 60 * 1000,
  })
}

/** Fetches only hours-by-client analytics data. */
export function useHoursByClient(searchParams: string) {
  const normalizedParams = normalizeParams(searchParams)

  return useQuery<{ hoursByClient: HoursByClient[] }>({
    queryKey: ["analytics", "hours-by-client", normalizedParams],
    queryFn: () => fetchSection(searchParams, "hours-by-client"),
    staleTime: 2 * 60 * 1000,
  })
}

/** Fetches only revenue-by-category analytics data. */
export function useRevenueByCategory(searchParams: string) {
  const normalizedParams = normalizeParams(searchParams)

  return useQuery<{ revenueByCategory: RevenueByCategory[] }>({
    queryKey: ["analytics", "revenue-by-category", normalizedParams],
    queryFn: () => fetchSection(searchParams, "revenue-by-category"),
    staleTime: 2 * 60 * 1000,
  })
}

/** Fetches only utilization analytics data. */
export function useUtilization(searchParams: string) {
  const normalizedParams = normalizeParams(searchParams)

  return useQuery<{ utilization: Utilization }>({
    queryKey: ["analytics", "utilization", normalizedParams],
    queryFn: () => fetchSection(searchParams, "utilization"),
    staleTime: 2 * 60 * 1000,
  })
}
