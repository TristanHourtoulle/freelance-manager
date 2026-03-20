"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { DeadlineTimeline } from "@/components/calendar/deadline-timeline"
import { CalendarHeader } from "@/components/calendar/calendar-header"
import { CalendarMonthView } from "@/components/calendar/calendar-month-view"
import { CalendarWeekView } from "@/components/calendar/calendar-week-view"
import { useCalendarDeadlines } from "@/hooks/use-calendar"

import type {
  CalendarView,
  CalendarDeadline,
} from "@/components/calendar/types"

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start, end }
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function filterDeadlinesByRange(
  deadlines: CalendarDeadline[],
  start: Date,
  end: Date,
): CalendarDeadline[] {
  return deadlines.filter((d) => {
    const date = new Date(d.date)
    return date >= start && date <= end
  })
}

const CALENDAR_VIEW_KEY = "fm-filters:calendar-view"

function getInitialView(): CalendarView {
  if (typeof window === "undefined") return "month"
  try {
    const stored = localStorage.getItem(CALENDAR_VIEW_KEY)
    if (stored === "month" || stored === "week" || stored === "timeline") {
      return stored
    }
  } catch {
    // Ignore storage errors
  }
  return "month"
}

export default function CalendarPage() {
  const t = useTranslations("calendar")
  const [view, setView] = useState<CalendarView>(getInitialView)
  const [currentDate, setCurrentDate] = useState(new Date())

  useEffect(() => {
    try {
      localStorage.setItem(CALENDAR_VIEW_KEY, view)
    } catch {
      // Ignore storage errors
    }
  }, [view])
  const { data, isLoading, error } = useCalendarDeadlines(view, currentDate)

  const allDeadlines = data?.deadlines ?? []

  const visibleDeadlines = useMemo(() => {
    if (view === "timeline") return allDeadlines

    const range =
      view === "month" ? getMonthRange(currentDate) : getWeekRange(currentDate)
    return filterDeadlinesByRange(allDeadlines, range.start, range.end)
  }, [allDeadlines, view, currentDate])

  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      setCurrentDate((prev) => {
        const next = new Date(prev)
        if (view === "month" || view === "timeline") {
          next.setMonth(next.getMonth() + (direction === "next" ? 1 : -1))
        } else {
          next.setDate(next.getDate() + (direction === "next" ? 7 : -7))
        }
        return next
      })
    },
    [view],
  )

  const handleToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <CalendarHeader
        view={view}
        currentDate={currentDate}
        onViewChange={setView}
        onNavigate={handleNavigate}
        onToday={handleToday}
      />

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
      ) : view === "month" ? (
        <CalendarMonthView
          deadlines={visibleDeadlines}
          currentDate={currentDate}
        />
      ) : view === "week" ? (
        <CalendarWeekView
          deadlines={visibleDeadlines}
          currentDate={currentDate}
        />
      ) : (
        <DeadlineTimeline deadlines={visibleDeadlines} />
      )}
    </div>
  )
}
