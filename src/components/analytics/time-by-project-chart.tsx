"use client"

import { useEffect, useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { Card } from "@/components/ui/card"

import type { ClientProjectsData } from "@/components/analytics/types"

const COLORS = [
  "#2563EB",
  "#3B82F6",
  "#60A5FA",
  "#93C5FD",
  "#BFDBFE",
  "#1D4ED8",
  "#1E40AF",
  "#DBEAFE",
]

interface TimeByProjectChartProps {
  clientId: string
  clientName: string
  period: string
  searchParams: string
  onBack: () => void
}

/**
 * Horizontal bar chart showing billed hours per project for a single client.
 * Fetches project data from the API on mount. Displayed as a drill-down from TimeByClientChart.
 * Used on the analytics page.
 *
 * @param onBack - Callback to navigate back to the client-level view.
 */
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

  const chartHeight = Math.max(256, (data?.projects.length ?? 0) * 40 + 64)

  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-md p-1.5 text-muted hover:bg-muted/10 hover:text-foreground transition-colors"
          aria-label="Back to clients"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div>
          <h3 className="text-base font-semibold">Time by Project</h3>
          <p className="text-sm text-muted">{clientName}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !data || data.projects.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted">
          No project data available for this client.
        </div>
      ) : (
        <>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.projects}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="projectName"
                  width={140}
                  tick={{ fontSize: 13 }}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [
                    `${value ?? 0}h`,
                    "Hours",
                  ]}
                  labelFormatter={(label: unknown) => {
                    const labelStr = String(label)
                    const project = data.projects.find(
                      (p) => p.projectName === labelStr,
                    )
                    return project
                      ? `${labelStr} — ${project.amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`
                      : labelStr
                  }}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--color-border)",
                    fontSize: "14px",
                  }}
                />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={24}>
                  {data.projects.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-sm text-muted">
            <span>
              Total: <strong className="text-foreground">{totalHours}h</strong>
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
    </Card>
  )
}
