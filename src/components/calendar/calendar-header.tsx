"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip-group"

import type { CalendarView } from "./types"

interface CalendarHeaderProps {
  view: CalendarView
  currentDate: Date
  onViewChange: (view: CalendarView) => void
  onNavigate: (direction: "prev" | "next") => void
  onToday: () => void
}

function formatHeaderLabel(view: CalendarView, date: Date): string {
  if (view === "week") {
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const diff = day === 0 ? -6 : 1 - day
    startOfWeek.setDate(startOfWeek.getDate() + diff)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(endOfWeek.getDate() + 6)

    const startStr = startOfWeek.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
    const endStr = endOfWeek.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    return `${startStr} - ${endStr}`
  }

  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })
}

/**
 * Calendar navigation header with view toggle and prev/next buttons.
 * Uses Chip components for view switching with stadium-shape styling.
 */
export function CalendarHeader({
  view,
  currentDate,
  onViewChange,
  onNavigate,
  onToday,
}: CalendarHeaderProps) {
  const t = useTranslations("calendar")

  const views: Array<{ value: CalendarView; label: string }> = [
    { value: "month", label: t("monthView") },
    { value: "week", label: t("weekView") },
    { value: "timeline", label: t("timelineView") },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Left: navigation */}
      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          size="icon"
          shape="default"
          onClick={() => onNavigate("prev")}
          aria-label={t("previous")}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          shape="default"
          onClick={() => onNavigate("next")}
          aria-label={t("next")}
        >
          <ChevronRightIcon className="size-4" />
        </Button>

        <h2 className="text-lg font-semibold">
          {formatHeaderLabel(view, currentDate)}
        </h2>

        <Button variant="outline" size="sm" shape="pill" onClick={onToday}>
          {t("today")}
        </Button>
      </div>

      {/* Right: view toggle */}
      <div className="flex items-center">
        {views.map((v, index) => {
          const position =
            views.length === 1
              ? "only"
              : index === 0
                ? "first"
                : index === views.length - 1
                  ? "last"
                  : "middle"
          return (
            <Chip
              key={v.value}
              label={v.label}
              isActive={view === v.value}
              onClick={() => onViewChange(v.value)}
              position={position}
            />
          )
        })}
      </div>
    </div>
  )
}
