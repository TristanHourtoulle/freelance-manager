"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartConfig = {
  amount: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

interface RevenueDataPoint {
  month: string
  label: string
  amount: number
}

interface ClientRevenueChartProps {
  data: RevenueDataPoint[]
}

export function ClientRevenueChart({ data }: ClientRevenueChartProps) {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-48 w-full sm:h-56 md:h-64"
    >
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value: string) => value.slice(0, 3)}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Bar dataKey="amount" fill="var(--color-amount)" radius={8} />
      </BarChart>
    </ChartContainer>
  )
}
