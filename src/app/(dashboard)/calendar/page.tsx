"use client"

import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { DeadlineTimeline } from "@/components/calendar/deadline-timeline"
import { useCalendarDeadlines } from "@/hooks/use-calendar"

export default function CalendarPage() {
  const t = useTranslations("calendar")
  const { data, isLoading, error } = useCalendarDeadlines()

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      {isLoading ? (
        <PageSkeleton variant="list" />
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Failed to fetch deadlines"}
          </p>
        </div>
      ) : (
        <DeadlineTimeline deadlines={data?.deadlines ?? []} />
      )}
    </div>
  )
}
