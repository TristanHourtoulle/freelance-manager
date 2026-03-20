"use client"

import { useQuery } from "@tanstack/react-query"

import type {
  FinancialPeriod,
  FinancialResponse,
} from "@/lib/schemas/financial"

interface UseFinancialOptions {
  period?: FinancialPeriod
  year?: number
}

async function fetchFinancial(
  period: FinancialPeriod,
  year: number,
): Promise<FinancialResponse> {
  const params = new URLSearchParams({ period, year: String(year) })
  const response = await fetch(`/api/financial?${params.toString()}`)

  if (!response.ok) {
    throw new Error("Failed to fetch financial data")
  }

  return response.json()
}

/**
 * Fetches P&L financial data grouped by the specified period.
 * Defaults to monthly aggregation for the current year.
 */
export function useFinancial(period?: FinancialPeriod | string, year?: number) {
  const resolvedPeriod = (period ?? "month") as FinancialPeriod
  const resolvedYear = year ?? new Date().getFullYear()

  return useQuery<FinancialResponse>({
    queryKey: ["financial", resolvedPeriod, resolvedYear],
    queryFn: () => fetchFinancial(resolvedPeriod, resolvedYear),
    staleTime: 5 * 60 * 1000,
  })
}
