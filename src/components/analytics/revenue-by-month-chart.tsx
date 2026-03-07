"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"

import type { RevenueByMonth } from "@/components/analytics/types"

interface RevenueByMonthChartProps {
  data: RevenueByMonth[]
}

export function RevenueByMonthChart({ data }: RevenueByMonthChartProps) {
  return (
    <Card title="Revenue by Month">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}\u202F\u20AC`}
            />
            <Tooltip
              formatter={(value: number | undefined) => [
                `${(value ?? 0).toLocaleString("fr-FR")} \u20AC`,
                "Revenue",
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                fontSize: "14px",
              }}
            />
            <Bar
              dataKey="amount"
              fill="var(--color-primary)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
