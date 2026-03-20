"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"

interface PnlPeriod {
  label: string
  revenue: number
  expenses: number
  profit: number
  margin: number
}

interface PnlTableProps {
  periods: PnlPeriod[]
  totals: {
    revenue: number
    expenses: number
    profit: number
    margin: number
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function PnlTable({ periods, totals }: PnlTableProps) {
  const t = useTranslations("financial")

  return (
    <Card className="py-0 overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  {t("period")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t("revenue")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t("expenses")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t("profit")}
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  {t("margin")}
                </th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr
                  key={period.label}
                  className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {period.label}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                    {formatCurrency(period.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                    {formatCurrency(period.expenses)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${
                      period.profit >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatCurrency(period.profit)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      period.margin >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {period.margin.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 font-semibold">
                <td className="px-4 py-3 text-text-primary">{t("totals")}</td>
                <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                  {formatCurrency(totals.revenue)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">
                  {formatCurrency(totals.expenses)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    totals.profit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(totals.profit)}
                </td>
                <td
                  className={`px-4 py-3 text-right tabular-nums ${
                    totals.margin >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {totals.margin.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
