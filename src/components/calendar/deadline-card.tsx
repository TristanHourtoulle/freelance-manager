import Link from "next/link"
import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui/badge"

import type { CalendarDeadline, DeadlineUrgency } from "./types"

interface DeadlineCardProps {
  deadline: CalendarDeadline
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

function getDaysDiff(dateStr: string): number {
  const now = new Date()
  const deadlineDate = new Date(dateStr)
  const diffMs = deadlineDate.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

const DOT_COLORS: Record<DeadlineUrgency, string> = {
  overdue: "bg-red-500",
  "due-soon": "bg-amber-500",
  upcoming: "bg-green-500",
}

/** Renders a single deadline entry in the timeline. */
export function DeadlineCard({ deadline }: DeadlineCardProps) {
  const t = useTranslations("calendar")
  const urgency = getUrgency(deadline.date)
  const daysDiff = getDaysDiff(deadline.date)
  const formattedDate = new Date(deadline.date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })

  const amount = deadline.metadata.amount

  function getUrgencyLabel(): string {
    if (daysDiff === 0) return t("today")
    if (daysDiff < 0) return t("daysOverdue", { days: Math.abs(daysDiff) })
    return t("daysUntil", { days: daysDiff })
  }

  function getUrgencyBadgeClasses(): string {
    switch (urgency) {
      case "overdue":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      case "due-soon":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      case "upcoming":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    }
  }

  function getStatusBadgeClasses(): string {
    switch (deadline.metadata.status) {
      case "SENT":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      case "DRAFT":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
    }
  }

  return (
    <div className="relative flex items-start gap-4 py-3">
      {/* Status dot */}
      <div className="mt-1.5 flex shrink-0 items-center justify-center">
        <span
          className={`block size-2.5 rounded-full ${DOT_COLORS[urgency]}`}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {formattedDate}
          </span>
          <Badge variant="outline" className={getUrgencyBadgeClasses()}>
            {getUrgencyLabel()}
          </Badge>
        </div>

        <Link
          href={`/billing/history`}
          className="mt-1 block text-sm text-foreground hover:underline"
        >
          {deadline.title}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {amount > 0 && (
            <span className="text-sm font-semibold text-foreground">
              {amount.toLocaleString(undefined, {
                style: "currency",
                currency: "EUR",
              })}
            </span>
          )}
          <Badge variant="outline" className={getStatusBadgeClasses()}>
            {deadline.metadata.status}
          </Badge>
          <Link
            href={`/clients/${deadline.clientId}`}
            className="text-xs text-muted-foreground hover:underline"
          >
            {deadline.clientName}
          </Link>
        </div>
      </div>
    </div>
  )
}
