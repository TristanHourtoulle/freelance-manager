"use client"

import { useTranslations } from "next-intl"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"

interface PnlPeriod {
  label: string
  revenue: number
  expenses: number
  profit: number
  margin: number
}

interface PnlChartProps {
  periods: PnlPeriod[]
}

export function PnlChart({ periods }: PnlChartProps) {
  const t = useTranslations("financial")

  const chartData = periods.map((p) => ({
    name: p.label,
    [t("revenue")]: p.revenue,
    [t("expenses")]: p.expenses,
    [t("profit")]: p.profit,
  }))

  return (
    <Card className="py-0">
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          {t("pnl")}
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                tickFormatter={(v) =>
                  new Intl.NumberFormat("fr-FR", {
                    notation: "compact",
                    compactDisplay: "short",
                  }).format(v)
                }
              />
              <Tooltip
                formatter={(value: number) =>
                  new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(value)
                }
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend />
              <Bar
                dataKey={t("revenue")}
                fill="var(--color-primary)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey={t("expenses")}
                fill="#ef4444"
                radius={[4, 4, 0, 0]}
              />
              <Bar dataKey={t("profit")} fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
