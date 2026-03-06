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

interface RevenueChartProps {
  data: Array<{ month: string; label: string; amount: number }>
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card title="Revenue (6 months)">
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
              tickFormatter={(v: number) => `${v}€`}
            />
            <Tooltip
              formatter={(value: number | undefined) => [
                `${(value ?? 0).toLocaleString("fr-FR")} €`,
                "Revenue",
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e4e4e7",
                fontSize: "14px",
              }}
            />
            <Bar
              dataKey="amount"
              fill="#18181b"
              radius={[4, 4, 0, 0]}
              className="dark:fill-zinc-300"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
