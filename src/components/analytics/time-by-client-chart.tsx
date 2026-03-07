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
  "#2563EB", // blue-600
  "#3B82F6", // blue-500
  "#60A5FA", // blue-400
  "#93C5FD", // blue-300
  "#BFDBFE", // blue-200
  "#1D4ED8", // blue-700
  "#1E40AF", // blue-800
  "#DBEAFE", // blue-100
]

interface TimeByClientChartProps {
  data: HoursByClient[]
  onClientClick?: (clientId: string, clientName: string) => void
}

export function TimeByClientChart({
  data,
  onClientClick,
}: TimeByClientChartProps) {
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
              style={onClientClick ? { cursor: "pointer" } : undefined}
              onClick={
                onClientClick
                  ? (_: unknown, index: number) => {
                      const entry = data[index]
                      if (entry) {
                        onClientClick(entry.clientId, entry.clientName)
                      }
                    }
                  : undefined
              }
            >
              {data.map((_, i) => (
                <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number | undefined) => [
                `${value ?? 0}h`,
                "Hours",
              ]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--color-border)",
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
