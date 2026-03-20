"use client"

import { useMemo, useState, useRef, useEffect, useCallback } from "react"
import { CalendarDaysIcon } from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"

import { DeadlineCard } from "./deadline-card"

import type { CalendarDeadline, DeadlineUrgency } from "./types"

interface CalendarWeekViewProps {
  deadlines: CalendarDeadline[]
  currentDate: Date
}

interface WeekDay {
  date: Date
  dateKey: string
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

function getWeekDays(
  currentDate: Date,
  deadlines: CalendarDeadline[],
): WeekDay[] {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  const startOfWeek = new Date(currentDate)
  const day = startOfWeek.getDay()
  const diff = day === 0 ? -6 : 1 - day
  startOfWeek.setDate(startOfWeek.getDate() + diff)
  startOfWeek.setHours(0, 0, 0, 0)

  const deadlineMap = new Map<string, CalendarDeadline[]>()
  for (const d of deadlines) {
    const dateKey = d.date.slice(0, 10)
    const existing = deadlineMap.get(dateKey) ?? []
    deadlineMap.set(dateKey, [...existing, d])
  }

  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(date.getDate() + i)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    days.push({
      date,
      dateKey,
      isToday: dateKey === todayStr,
      deadlines: deadlineMap.get(dateKey) ?? [],
    })
  }

  return days
}

export function CalendarWeekView({
  deadlines,
  currentDate,
}: CalendarWeekViewProps) {
  const t = useTranslations("calendar")
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const weekDays = useMemo(
    () => getWeekDays(currentDate, deadlines),
    [currentDate, deadlines],
  )

  const handleDayClick = useCallback((day: WeekDay) => {
    if (day.deadlines.length === 0) {
      setSelectedDay(null)
      return
    }
    setSelectedDay((prev) => (prev === day.dateKey ? null : day.dateKey))
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
      {weekDays.map((day, index) => {
        const hasDeadlines = day.deadlines.length > 0
        const isSelected = selectedDay === day.dateKey

        return (
          <div key={day.dateKey} className="relative">
            <button
              type="button"
              onClick={() => handleDayClick(day)}
              className={`
                w-full rounded-xl border bg-surface p-3 min-h-[140px] text-left transition-all
                ${day.isToday ? "border-primary ring-2 ring-primary/20" : "border-border"}
                ${hasDeadlines ? "cursor-pointer hover:bg-accent/30" : "cursor-default"}
                ${isSelected ? "bg-accent/40" : ""}
              `}
            >
              {/* Day header */}
              <div className="mb-2 text-center">
                <p className="text-xs font-medium text-muted-foreground">
                  {day.date.toLocaleDateString(undefined, { weekday: "short" })}
                </p>
                <p
                  className={`
                    text-lg font-semibold
                    ${day.isToday ? "inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground" : "text-foreground"}
                  `}
                >
                  {day.date.getDate()}
                </p>
              </div>

              {/* Deadline badges */}
              {hasDeadlines ? (
                <div className="flex flex-col gap-1">
                  {day.deadlines.slice(0, 3).map((d) => {
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
                        className={`flex items-center justify-between gap-1 rounded px-2 py-0.5 text-[10px] leading-4 font-medium ${bgColor}`}
                        title={`${d.clientName} — ${urgencyLabel}`}
                      >
                        <span className="truncate">{d.clientName}</span>
                        <span className="shrink-0 opacity-70">
                          {urgencyLabel}
                        </span>
                      </span>
                    )
                  })}
                  {day.deadlines.length > 3 && (
                    <span className="text-[10px] text-muted-foreground pl-1">
                      +{day.deadlines.length - 3}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-muted-foreground/40">
                  <CalendarDaysIcon className="size-5" />
                </div>
              )}
            </button>

            {/* Popover for selected day */}
            {isSelected && hasDeadlines && (
              <div
                ref={popoverRef}
                className={`absolute top-full z-50 mt-1 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg ${
                  index >= 5 ? "right-0" : "left-0"
                }`}
                role="dialog"
                aria-label={`${t("deadlines")} - ${day.date.toLocaleDateString()}`}
              >
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  {day.date.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {day.deadlines.map((deadline) => (
                    <DeadlineCard key={deadline.id} deadline={deadline} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
