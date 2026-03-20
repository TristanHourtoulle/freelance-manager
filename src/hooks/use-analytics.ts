"use client"

import { useQuery } from "@tanstack/react-query"

import type { AnalyticsData } from "@/components/analytics/types"

/**
 * Fetches analytics data with filters. Defaults period to "3m" if not specified.
 * Cached for 2 minutes.
 */
export function useAnalytics(searchParams: string) {
  const params = new URLSearchParams(searchParams)
  if (!params.has("period")) {
    params.set("period", "3m")
  }
  const normalizedParams = params.toString()

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
