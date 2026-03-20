"use client"

import { useMemo } from "react"
import { Label, Pie, PieChart } from "recharts"
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
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"

import type { RevenueByCategory } from "@/components/analytics/types"

const chartConfig = {
  amount: {
    label: "Revenue",
  },
  FREELANCE: {
    label: "Freelance",
    color: "var(--chart-1)",
  },
  STUDY: {
    label: "Study",
    color: "var(--chart-2)",
  },
  PERSONAL: {
    label: "Personal",
    color: "var(--chart-4)",
  },
  SIDE_PROJECT: {
    label: "Side Project",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

interface RevenueByCategoryChartProps {
  data: RevenueByCategory[]
}

export function RevenueByCategoryChart({ data }: RevenueByCategoryChartProps) {
  const t = useTranslations("analyticsCharts")
  const totalRevenue = useMemo(
    () => data.reduce((sum, d) => sum + d.amount, 0),
    [data],
  )

  const enrichedData = useMemo(
    () => data.map((d) => ({ ...d, fill: `var(--color-${d.category})` })),
    [data],
  )

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>{t("revenueByCategory")}</CardTitle>
        <CardDescription>{t("revenueSplitByCategory")}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[280px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={enrichedData}
              dataKey="amount"
              nameKey="category"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                    return null
                  }
                  return (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-3xl font-bold"
                      >
                        {totalRevenue.toLocaleString("fr-FR")}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 24}
                        className="fill-muted-foreground"
                      >
                        EUR
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="category" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
