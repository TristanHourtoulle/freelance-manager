"use client"

import { useEffect, useState, useMemo } from "react"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { Card, CardContent } from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

import type { ClientProjectsData } from "@/components/analytics/types"

interface TimeByProjectChartProps {
  clientId: string
  clientName: string
  period: string
  searchParams: string
  onBack: () => void
}

export function TimeByProjectChart({
  clientId,
  clientName,
  period,
  searchParams,
  onBack,
}: TimeByProjectChartProps) {
  const [data, setData] = useState<ClientProjectsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)

      const params = new URLSearchParams(searchParams)
      if (!params.has("period")) {
        params.set("period", period)
      }

      const res = await fetch(
        `/api/analytics/client/${clientId}/projects?${params.toString()}`,
        { cache: "no-store" },
      )

      if (!cancelled && res.ok) {
        const json: ClientProjectsData = await res.json()
        setData(json)
      }
      if (!cancelled) {
        setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [clientId, period, searchParams])

  const totalHours = data?.projects.reduce((sum, p) => sum + p.hours, 0) ?? 0
  const totalAmount = data?.projects.reduce((sum, p) => sum + p.amount, 0) ?? 0

  const chartHeight = Math.max(256, (data?.projects.length ?? 0) * 44 + 64)

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      hours: { label: "Hours" },
    }
    if (data) {
      for (const [i, project] of data.projects.entries()) {
        config[project.projectName] = {
          label: project.projectName,
          color: `var(--chart-${(i % 5) + 1})`,
        }
      }
    }
    return config
  }, [data])

  const enrichedData = useMemo(
    () =>
      data?.projects.map((p) => ({
        ...p,
        fill: `var(--color-${p.projectName})`,
      })) ?? [],
    [data],
  )

  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Back to clients"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h3 className="text-base font-semibold">Time by Project</h3>
            <p className="text-sm text-muted-foreground">{clientName}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !data || data.projects.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
            No project data available for this client.
          </div>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto w-full"
              style={{ height: chartHeight }}
            >
              <BarChart
                accessibilityLayer
                data={enrichedData}
                layout="vertical"
                margin={{ left: 0 }}
              >
                <YAxis
                  type="category"
                  dataKey="projectName"
                  width={140}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <XAxis type="number" dataKey="hours" hide />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar dataKey="hours" radius={5} />
              </BarChart>
            </ChartContainer>

            <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-sm text-muted-foreground">
              <span>
                Total:{" "}
                <strong className="text-foreground">{totalHours}h</strong>
              </span>
              <span>
                Amount:{" "}
                <strong className="text-foreground">
                  {totalAmount.toLocaleString("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </strong>
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
