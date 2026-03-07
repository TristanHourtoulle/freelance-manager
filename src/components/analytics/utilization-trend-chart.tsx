"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"

import type { UtilizationMonth } from "@/components/analytics/types"

interface UtilizationTrendChartProps {
  data: UtilizationMonth[]
}

export function UtilizationTrendChart({ data }: UtilizationTrendChartProps) {
  return (
    <Card title="Monthly Utilization">
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
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number | undefined) => [
                `${value ?? 0}%`,
                "Utilization",
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
                fontSize: "14px",
              }}
            />
            <ReferenceLine
              y={100}
              stroke="var(--color-destructive)"
              strokeDasharray="4 4"
              label={{
                value: "100%",
                position: "right",
                fontSize: 11,
                fill: "var(--color-text-secondary)",
              }}
            />
            <Bar
              dataKey="rate"
              fill="var(--color-primary)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
