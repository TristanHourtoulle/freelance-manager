"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

const MS_PER_DAY = 86_400_000

interface ActivityIndicatorProps {
  lastActivityAt: string | null
  showLabel?: boolean
}

function getDotColor(lastActivityAt: string | null, now: number): string {
  if (!lastActivityAt) return "bg-red-500"

  const diffDays = Math.floor(
    (now - new Date(lastActivityAt).getTime()) / MS_PER_DAY,
  )

  if (diffDays < 7) return "bg-green-500"
  if (diffDays < 30) return "bg-amber-500"
  return "bg-red-500"
}

/**
 * Colored dot (green/amber/red) with an optional relative-time label indicating
 * how recently a client had activity. Used in ClientCard and ClientRow.
 */
export function ActivityIndicator({
  lastActivityAt,
  showLabel = true,
}: ActivityIndicatorProps) {
  const t = useTranslations("activityIndicator")
  const tc = useTranslations("common")
  const [now] = useState(() => Date.now())

  const dotColor = getDotColor(lastActivityAt, now)

  let label: string
  if (!lastActivityAt) {
    label = tc("noActivity")
  } else {
    const diffMs = now - new Date(lastActivityAt).getTime()
    const diffDays = Math.floor(diffMs / MS_PER_DAY)

    if (diffDays === 0) {
      label = t("today")
    } else if (diffDays === 1) {
      label = t("yesterday")
    } else if (diffDays < 30) {
      label = t("daysAgo", { days: diffDays })
    } else {
      const diffMonths = Math.floor(diffDays / 30)
      if (diffMonths < 12) {
        label = t("monthsAgo", { months: diffMonths })
      } else {
        label = t("yearsAgo", { years: Math.floor(diffDays / 365) })
      }
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotColor}`}
      />
      {showLabel && (
        <span className="text-xs text-text-secondary">{label}</span>
      )}
    </div>
  )
}
