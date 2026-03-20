"use client"

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
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

import type { RevenueByMonth } from "@/components/analytics/types"

const chartConfig = {
  amount: {
    label: "Revenue",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

interface RevenueByMonthChartProps {
  data: RevenueByMonth[]
}

export function RevenueByMonthChart({ data }: RevenueByMonthChartProps) {
  const t = useTranslations("analyticsCharts")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("revenueByMonth")}</CardTitle>
        <CardDescription>{t("revenueByMonth")}</CardDescription>
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
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={8} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
