"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import {
  BanknotesIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent } from "@/components/ui/card"

import type { SerializedExpense } from "@/hooks/use-expenses"

interface ExpenseSummaryProps {
  expenses: SerializedExpense[]
}

export function ExpenseSummary({ expenses }: ExpenseSummaryProps) {
  const t = useTranslations("expenses")

  const { totalAll, totalThisMonth, recurringMonthly } = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()

    let allTotal = 0
    let monthTotal = 0
    let recurringTotal = 0

    for (const expense of expenses) {
      allTotal += expense.amount
      const expenseDate = new Date(expense.date)
      if (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      ) {
        monthTotal += expense.amount
      }
      if (expense.recurring) {
        recurringTotal += expense.amount
      }
    }

    return {
      totalAll: allTotal,
      totalThisMonth: monthTotal,
      recurringMonthly: recurringTotal,
    }
  }, [expenses])

  const kpis = [
    {
      label: t("totalExpenses"),
      value: totalAll,
      icon: BanknotesIcon,
    },
    {
      label: t("thisMonth"),
      value: totalThisMonth,
      icon: CalendarDaysIcon,
    },
    {
      label: t("recurringMonthly"),
      value: recurringMonthly,
      icon: ArrowPathIcon,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label} size="sm">
          <CardContent className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <kpi.icon className="size-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-lg font-semibold tabular-nums">
                {kpi.value.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                EUR
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
