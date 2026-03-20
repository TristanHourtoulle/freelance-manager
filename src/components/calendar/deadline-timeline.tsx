import { useMemo } from "react"
import { CalendarDaysIcon } from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"
import { DeadlineCard } from "./deadline-card"

import type { CalendarDeadline } from "./types"

interface DeadlineTimelineProps {
  deadlines: CalendarDeadline[]
}

interface MonthGroup {
  key: string
  label: string
  deadlines: CalendarDeadline[]
}

function groupByMonth(deadlines: CalendarDeadline[]): MonthGroup[] {
  const groups = new Map<string, CalendarDeadline[]>()

  for (const deadline of deadlines) {
    const date = new Date(deadline.date)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    const existing = groups.get(key) ?? []
    groups.set(key, [...existing, deadline])
  }

  const result: MonthGroup[] = []
  for (const [key, items] of groups) {
    const [year, month] = key.split("-")
    const date = new Date(Number(year), Number(month) - 1, 1)
    const label = date.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
    result.push({ key, label, deadlines: items })
  }

  result.sort((a, b) => a.key.localeCompare(b.key))
  return result
}

/** Renders deadlines grouped by month with a vertical timeline. */
export function DeadlineTimeline({ deadlines }: DeadlineTimelineProps) {
  const t = useTranslations("calendar")
  const monthGroups = useMemo(() => groupByMonth(deadlines), [deadlines])

  if (deadlines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-16 text-center">
        <CalendarDaysIcon className="mb-4 size-12 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">
          {t("noDeadlines")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("noDeadlinesHint")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {monthGroups.map((group) => (
        <div key={group.key}>
          {/* Month header */}
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </h2>

          {/* Timeline card list */}
          <div className="rounded-xl border border-border bg-surface">
            <div className="divide-y divide-border px-4">
              {group.deadlines.map((deadline) => (
                <DeadlineCard key={deadline.id} deadline={deadline} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
