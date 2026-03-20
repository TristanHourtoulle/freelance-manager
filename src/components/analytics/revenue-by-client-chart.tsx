"use client"

import { useMemo } from "react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
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

import type { RevenueByClient } from "@/components/analytics/types"

interface RevenueByClientChartProps {
  data: RevenueByClient[]
}

export function RevenueByClientChart({ data }: RevenueByClientChartProps) {
  const t = useTranslations("analyticsCharts")
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {}
    for (const [i, entry] of data.entries()) {
      config[entry.clientName] = {
        label: entry.clientName,
        color: `var(--chart-${(i % 5) + 1})`,
      }
    }
    config["amount"] = { label: "Revenue" }
    return config
  }, [data])

  const enrichedData = useMemo(
    () => data.map((d) => ({ ...d, fill: `var(--color-${d.clientName})` })),
    [data],
  )

  const chartHeight = Math.max(256, data.length * 44)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("revenueByClient")}</CardTitle>
        <CardDescription>{t("totalRevenuePerClient")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto w-full"
          style={{ height: chartHeight }}
        >
          <BarChart
            accessibilityLayer
            layout="vertical"
            data={enrichedData}
            margin={{ left: 0 }}
          >
            <YAxis
              type="category"
              dataKey="clientName"
              width={120}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <XAxis type="number" dataKey="amount" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="amount" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
