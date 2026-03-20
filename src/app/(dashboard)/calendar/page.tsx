"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { DeadlineTimeline } from "@/components/calendar/deadline-timeline"

import type { CalendarDeadline } from "@/components/calendar/types"

export default function CalendarPage() {
  const t = useTranslations("calendar")
  const [deadlines, setDeadlines] = useState<CalendarDeadline[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchDeadlines() {
      try {
        const response = await fetch("/api/calendar")
        if (!response.ok) {
          throw new Error("Failed to fetch deadlines")
        }
        const data: { deadlines: CalendarDeadline[] } = await response.json()
        if (!cancelled) {
          setDeadlines(data.deadlines)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch deadlines",
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchDeadlines()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      {isLoading ? (
        <PageSkeleton variant="list" />
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : (
        <DeadlineTimeline deadlines={deadlines} />
      )}
    </div>
  )
}
