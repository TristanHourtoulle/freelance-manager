"use client"

import { useQuery } from "@tanstack/react-query"

import type { CalendarDeadline } from "@/components/calendar/types"

interface CalendarResponse {
  deadlines: CalendarDeadline[]
}

/**
 * Fetches calendar deadlines. Cached for 2 minutes.
 */
export function useCalendarDeadlines() {
  return useQuery<CalendarResponse>({
    queryKey: ["calendar"],
    queryFn: async () => {
      const res = await fetch("/api/calendar")
      if (!res.ok) throw new Error("Failed to fetch deadlines")
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })
}
