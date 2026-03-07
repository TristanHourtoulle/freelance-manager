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

import type { RevenueByCategory } from "@/components/analytics/types"

const CATEGORY_COLORS: Record<string, string> = {
  FREELANCE: "#2563EB",
  STUDY: "#8B5CF6",
  PERSONAL: "#F59E0B",
  SIDE_PROJECT: "#10B981",
}

interface RevenueByCategoryChartProps {
  data: RevenueByCategory[]
}

export function RevenueByCategoryChart({ data }: RevenueByCategoryChartProps) {
  return (
    <Card title="Revenue by Category">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={CATEGORY_COLORS[entry.category] ?? "#94A3B8"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number | undefined) => [
                `${(value ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`,
                "Revenue",
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
