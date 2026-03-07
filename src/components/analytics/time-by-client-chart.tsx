"use client"

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"

import type { HoursByClient } from "@/components/analytics/types"

const COLORS = [
  "#18181b",
  "#3f3f46",
  "#71717a",
  "#a1a1aa",
  "#d4d4d8",
  "#52525b",
  "#27272a",
  "#e4e4e7",
]

interface TimeByClientChartProps {
  data: HoursByClient[]
}

export function TimeByClientChart({ data }: TimeByClientChartProps) {
  return (
    <Card title="Time by Client">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="hours"
              nameKey="clientName"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={COLORS[i % COLORS.length]}
                  className={i % 2 === 0 ? "" : "dark:opacity-80"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number | undefined) => [
                `${value ?? 0}h`,
                "Hours",
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e4e4e7",
                fontSize: "14px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
