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

import type { RevenueByClient } from "@/components/analytics/types"

interface RevenueByClientChartProps {
  data: RevenueByClient[]
}

export function RevenueByClientChart({ data }: RevenueByClientChartProps) {
  const chartHeight = Math.max(256, data.length * 40)

  return (
    <Card title="Revenue by Client">
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data}>
            <XAxis
              type="number"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}\u202F\u20AC`}
            />
            <YAxis
              type="category"
              dataKey="clientName"
              width={120}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
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
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
