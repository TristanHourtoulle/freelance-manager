"use client"

import { useQuery } from "@tanstack/react-query"

import type {
  CalendarDeadline,
  CalendarView,
} from "@/components/calendar/types"

interface CalendarResponse {
  deadlines: CalendarDeadline[]
}

/**
 * Fetches calendar deadlines. Cached for 2 minutes.
 * Accepts optional view and date params to pass as query parameters.
 */
export function useCalendarDeadlines(view?: CalendarView, date?: Date) {
  const params = new URLSearchParams()
  if (view) params.set("view", view)
  if (date) params.set("date", date.toISOString())
  const queryString = params.toString()

  return useQuery<CalendarResponse>({
    queryKey: ["calendar", view ?? "all", date?.toISOString() ?? "default"],
    queryFn: async () => {
      const url = queryString ? `/api/calendar?${queryString}` : "/api/calendar"
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch deadlines")
      return res.json()
    },
    staleTime: 2 * 60 * 1000,
  })
}
