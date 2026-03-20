"use client"

import { useMemo } from "react"
import { CalendarDaysIcon } from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"

import { DeadlineCard } from "./deadline-card"

import type { CalendarDeadline } from "./types"

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

function getWeekDays(
  currentDate: Date,
  deadlines: CalendarDeadline[],
): WeekDay[] {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  // Find Monday of the current week
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

/**
 * Weekly calendar view showing a card per day with full deadline details.
 * Each day column is taller to accommodate the full deadline list.
 */
export function CalendarWeekView({
  deadlines,
  currentDate,
}: CalendarWeekViewProps) {
  const t = useTranslations("calendar")
  const weekDays = useMemo(
    () => getWeekDays(currentDate, deadlines),
    [currentDate, deadlines],
  )

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
      {weekDays.map((day) => (
        <div
          key={day.dateKey}
          className={`
            rounded-xl border bg-surface p-3 min-h-[200px] transition-all
            ${day.isToday ? "border-primary ring-2 ring-primary/20" : "border-border"}
          `}
        >
          {/* Day header */}
          <div className="mb-3 text-center">
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

          {/* Deadlines */}
          {day.deadlines.length > 0 ? (
            <div className="space-y-2">
              {day.deadlines.map((deadline) => (
                <DeadlineCard key={deadline.id} deadline={deadline} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-muted-foreground/40">
              <CalendarDaysIcon className="size-5" />
              <p className="mt-1 text-[10px]">{t("noDeadlines")}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
