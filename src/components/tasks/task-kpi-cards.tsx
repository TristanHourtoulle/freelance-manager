"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"

import { StatCard, StatCardGroup } from "@/components/ui/stat-card"

import type { ClientTaskGroup } from "./types"

interface TaskKpiCardsProps {
  groups: ClientTaskGroup[]
}

function formatEur(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

export function TaskKpiCards({ groups }: TaskKpiCardsProps) {
  const t = useTranslations("tasks.kpi")
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

  return (
    <StatCardGroup>
      <StatCard
        label={t("billableAmount")}
        value={formatEur(stats.billableAmount)}
      />
      <StatCard
        label={t("completedTasks")}
        value={String(stats.completedTasks)}
      />
      <StatCard label={t("totalTasks")} value={String(stats.totalTasks)} />
      <StatCard label={t("totalHours")} value={`${stats.totalHours} h`} />
    </StatCardGroup>
  )
}
