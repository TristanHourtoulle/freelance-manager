"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { PeriodSelector } from "@/components/analytics/period-selector"
import { RevenueByMonthChart } from "@/components/analytics/revenue-by-month-chart"
import { RevenueByClientChart } from "@/components/analytics/revenue-by-client-chart"
import { TimeByClientChart } from "@/components/analytics/time-by-client-chart"
import { TimeByProjectChart } from "@/components/analytics/time-by-project-chart"
import { RevenueByCategoryChart } from "@/components/analytics/revenue-by-category-chart"
import { UtilizationGauge } from "@/components/analytics/utilization-gauge"
import { UtilizationTrendChart } from "@/components/analytics/utilization-trend-chart"
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton"
import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state"

import type { AnalyticsData } from "@/components/analytics/types"

export default function AnalyticsPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<{
    id: string
    name: string
  } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setSelectedClient(null)
      const params = new URLSearchParams(searchParams.toString())
      if (!params.has("period")) {
        params.set("period", "3m")
      }

      const res = await fetch(`/api/analytics?${params.toString()}`, {
        cache: "no-store",
      })

      if (!cancelled && res.ok) {
        const json: AnalyticsData = await res.json()
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
  }, [searchParams])

  const isEmpty =
    data !== null &&
    data.revenueByMonth.every((m) => m.amount === 0) &&
    data.revenueByClient.every((c) => c.amount === 0) &&
    data.hoursByClient.every((c) => c.hours === 0) &&
    data.revenueByCategory.every((c) => c.amount === 0)

  return (
    <div className="space-y-6">
      <h1>Analytics</h1>

      <PeriodSelector />

      {isLoading ? (
        <AnalyticsSkeleton />
      ) : isEmpty ? (
        <AnalyticsEmptyState />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <UtilizationGauge utilization={data.utilization} />
            <UtilizationTrendChart data={data.utilization.byMonth} />
          </div>
          <RevenueByMonthChart data={data.revenueByMonth} />
          <div className="grid gap-4 lg:grid-cols-2">
            <RevenueByClientChart data={data.revenueByClient} />
            <RevenueByCategoryChart data={data.revenueByCategory} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {selectedClient ? (
              <TimeByProjectChart
                clientId={selectedClient.id}
                clientName={selectedClient.name}
                period={searchParams.get("period") ?? "3m"}
                searchParams={searchParams.toString()}
                onBack={() => setSelectedClient(null)}
              />
            ) : (
              <TimeByClientChart
                data={data.hoursByClient}
                onClientClick={(id, name) => setSelectedClient({ id, name })}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
