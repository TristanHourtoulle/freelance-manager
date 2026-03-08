"use client"

import { useMemo } from "react"
import { Label, Pie, PieChart } from "recharts"
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

import type { HoursByClient } from "@/components/analytics/types"

interface TimeByClientChartProps {
  data: HoursByClient[]
  onClientClick?: (clientId: string, clientName: string) => void
}

export function TimeByClientChart({
  data,
  onClientClick,
}: TimeByClientChartProps) {
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      hours: { label: "Hours" },
    }
    for (const [i, entry] of data.entries()) {
      config[entry.clientName] = {
        label: entry.clientName,
        color: `var(--chart-${(i % 5) + 1})`,
      }
    }
    return config
  }, [data])

  const totalHours = useMemo(
    () => data.reduce((sum, d) => sum + d.hours, 0),
    [data],
  )

  const enrichedData = useMemo(
    () => data.map((d) => ({ ...d, fill: `var(--color-${d.clientName})` })),
    [data],
  )

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Time by Client</CardTitle>
        <CardDescription>Billed hours per client</CardDescription>
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
              dataKey="hours"
              nameKey="clientName"
              innerRadius={60}
              strokeWidth={5}
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
                        {totalHours}
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 24}
                        className="fill-muted-foreground"
                      >
                        Hours
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="clientName" />}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
