"use client"

import { useQuery } from "@tanstack/react-query"

import type { DashboardKPIs } from "@/components/dashboard/types"
import type { OnboardingStatus } from "@/components/onboarding/types"

/**
 * Fetches dashboard KPI data. Cached for 2 minutes.
 */
export function useDashboard() {
  return useQuery<DashboardKPIs>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard")
      if (!res.ok) throw new Error("Failed to fetch dashboard")
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Fetches onboarding progress status. Cached for 10 minutes.
 */
export function useOnboarding() {
  return useQuery<OnboardingStatus>({
    queryKey: ["onboarding"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding")
      if (!res.ok) throw new Error("Failed to fetch onboarding status")
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })
}
