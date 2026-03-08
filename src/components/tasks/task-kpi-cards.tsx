"use client"

import { useMemo } from "react"

import { Card, CardContent } from "@/components/ui/card"

import type { ClientTaskGroup } from "./types"

interface TaskKpiCardsProps {
  groups: ClientTaskGroup[]
}

/** Formats a number as EUR currency using fr-FR locale. */
function formatEur(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

/**
 * Displays a grid of KPI stat cards summarizing task metrics
 * across all client groups: total tasks, hours, billable amount, and completed count.
 */
export function TaskKpiCards({ groups }: TaskKpiCardsProps) {
  const stats = useMemo(() => {
    let totalTasks = 0
    let totalHours = 0
    let billableAmount = 0
    let completedTasks = 0

    for (const group of groups) {
      totalTasks += group.taskCount

      for (const task of group.tasks) {
        totalHours += task.estimate ?? 0

        if (task.toInvoice) {
          billableAmount += task.billingAmount
        }

        if (task.status?.type === "completed") {
          completedTasks += 1
        }
      }
    }

    return { totalTasks, totalHours, billableAmount, completedTasks }
  }, [groups])

  const cards = [
    { label: "Total Tasks", value: String(stats.totalTasks) },
    { label: "Total Hours", value: `${stats.totalHours}h` },
    { label: "Billable Amount", value: formatEur(stats.billableAmount) },
    { label: "Completed Tasks", value: String(stats.completedTasks) },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} size="sm">
          <CardContent>
            <p className="text-xs uppercase text-muted-foreground">
              {card.label}
            </p>
            <p className="text-2xl font-bold tracking-tight">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
