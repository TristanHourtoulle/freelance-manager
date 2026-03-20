"use client"

import { useMemo, useState, useRef, useEffect, useCallback } from "react"
import { useTranslations } from "next-intl"

import { DeadlineCard } from "./deadline-card"

import type { CalendarDeadline, DeadlineUrgency } from "./types"

interface CalendarMonthViewProps {
  deadlines: CalendarDeadline[]
  currentDate: Date
}

interface DayCell {
  date: Date
  dayNumber: number
  isCurrentMonth: boolean
  isToday: boolean
  deadlines: CalendarDeadline[]
}

function getUrgency(dateStr: string): DeadlineUrgency {
  const now = new Date()
  const deadlineDate = new Date(dateStr)
  const diffMs = deadlineDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return "overdue"
  if (diffDays <= 7) return "due-soon"
  return "upcoming"
}

const DOT_COLORS: Record<DeadlineUrgency, string> = {
  overdue: "bg-red-500",
  "due-soon": "bg-amber-500",
  upcoming: "bg-green-500",
}

function buildMonthGrid(
  year: number,
  month: number,
  deadlines: CalendarDeadline[],
): DayCell[] {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)

  // Monday = 0, Sunday = 6
  let startDay = firstDayOfMonth.getDay() - 1
  if (startDay < 0) startDay = 6

  const deadlineMap = new Map<string, CalendarDeadline[]>()
  for (const d of deadlines) {
    const dateKey = d.date.slice(0, 10)
    const existing = deadlineMap.get(dateKey) ?? []
    deadlineMap.set(dateKey, [...existing, d])
  }

  const cells: DayCell[] = []

  // Days from previous month
  for (let i = startDay - 1; i >= 0; i--) {
    const date = new Date(year, month, -i)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    cells.push({
      date,
      dayNumber: date.getDate(),
      isCurrentMonth: false,
      isToday: dateKey === todayStr,
      deadlines: deadlineMap.get(dateKey) ?? [],
    })
  }

  // Days in current month
  for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
    const date = new Date(year, month, d)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    cells.push({
      date,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateKey === todayStr,
      deadlines: deadlineMap.get(dateKey) ?? [],
    })
  }

  // Fill remaining cells to complete the grid (6 rows max)
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i)
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      cells.push({
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        deadlines: deadlineMap.get(dateKey) ?? [],
      })
    }
  }

  return cells
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/**
 * Monthly calendar grid displaying deadlines as colored dots.
 * Clicking a day with deadlines reveals a popover with details.
 */
export function CalendarMonthView({
  deadlines,
  currentDate,
}: CalendarMonthViewProps) {
  const t = useTranslations("calendar")
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const cells = useMemo(
    () =>
      buildMonthGrid(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        deadlines,
      ),
    [currentDate, deadlines],
  )

  const handleDayClick = useCallback((cell: DayCell) => {
    if (cell.deadlines.length === 0) {
      setSelectedDay(null)
      return
    }
    const key = cell.date.toISOString()
    setSelectedDay((prev) => (prev === key ? null : key))
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setSelectedDay(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-2">
        {WEEKDAY_LABELS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, index) => {
          const cellKey = cell.date.toISOString()
          const isSelected = selectedDay === cellKey
          const hasDeadlines = cell.deadlines.length > 0

          return (
            <div key={index} className="relative">
              <button
                type="button"
                onClick={() => handleDayClick(cell)}
                className={`
                  w-full min-h-[72px] p-2 text-left transition-colors
                  border border-transparent rounded-lg
                  ${cell.isCurrentMonth ? "text-foreground" : "text-muted-foreground/40"}
                  ${cell.isToday ? "ring-2 ring-primary bg-primary/5" : ""}
                  ${hasDeadlines ? "cursor-pointer hover:bg-accent/30" : "cursor-default"}
                  ${isSelected ? "bg-accent/40" : ""}
                `}
                aria-label={`${cell.date.toLocaleDateString()}, ${cell.deadlines.length} ${t("deadlines")}`}
              >
                <span
                  className={`
                    text-sm font-medium
                    ${cell.isToday ? "inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground" : ""}
                  `}
                >
                  {cell.dayNumber}
                </span>

                {hasDeadlines && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {cell.deadlines.slice(0, 2).map((d) => {
                      const urgency = getUrgency(d.date)
                      const diffDays = Math.ceil(
                        (new Date(d.date).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24),
                      )
                      const urgencyLabel =
                        diffDays < 0
                          ? t("daysOverdue", { days: Math.abs(diffDays) })
                          : diffDays === 0
                            ? t("today")
                            : t("daysUntil", { days: diffDays })
                      const bgColor =
                        urgency === "overdue"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : urgency === "due-soon"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      return (
                        <span
                          key={d.id}
                          className={`flex items-center justify-between gap-1 rounded px-2 text-[10px] leading-4 font-medium ${bgColor}`}
                          title={`${d.clientName} — ${urgencyLabel}`}
                        >
                          <span className="truncate">{d.clientName}</span>
                          <span className="shrink-0 opacity-70">
                            {urgencyLabel}
                          </span>
                        </span>
                      )
                    })}
                    {cell.deadlines.length > 2 && (
                      <span className="text-[10px] text-muted-foreground pl-1">
                        +{cell.deadlines.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </button>

              {/* Popover for selected day */}
              {isSelected && hasDeadlines && (
                <div
                  ref={popoverRef}
                  className={`absolute top-full z-50 mt-1 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg ${
                    index % 7 >= 5 ? "right-0" : "left-0"
                  }`}
                  role="dialog"
                  aria-label={`${t("deadlines")} - ${cell.date.toLocaleDateString()}`}
                >
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    {cell.date.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {cell.deadlines.map((deadline) => (
                      <DeadlineCard key={deadline.id} deadline={deadline} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
