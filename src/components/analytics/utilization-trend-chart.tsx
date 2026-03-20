"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

import type { UtilizationMonth } from "@/components/analytics/types"

const chartConfig = {
  rate: {
    label: "Utilization",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

interface UtilizationTrendChartProps {
  data: UtilizationMonth[]
}

export function UtilizationTrendChart({ data }: UtilizationTrendChartProps) {
  const t = useTranslations("analyticsCharts")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("monthlyUtilization")}</CardTitle>
        <CardDescription>{t("utilizationOverTime")}</CardDescription>
      </CardHeader>
      <CardContent>
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
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <ReferenceLine
              y={100}
              stroke="hsl(var(--destructive))"
              strokeDasharray="4 4"
            />
            <Bar dataKey="rate" fill="var(--color-rate)" radius={8} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
