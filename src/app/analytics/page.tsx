"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PeriodSelector } from "@/components/analytics/period-selector"
import { RevenueByMonthChart } from "@/components/analytics/revenue-by-month-chart"
import { RevenueByClientChart } from "@/components/analytics/revenue-by-client-chart"
import { TimeByClientChart } from "@/components/analytics/time-by-client-chart"
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton"
import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state"

import type { AnalyticsData } from "@/components/analytics/types"

export default function AnalyticsPage() {
  const searchParams = useSearchParams()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
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
    data.hoursByClient.every((c) => c.hours === 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Analytics
        </h1>
        <Link href="/">
          <Button variant="secondary">Dashboard</Button>
        </Link>
      </div>

      <PeriodSelector />

      {isLoading ? (
        <AnalyticsSkeleton />
      ) : isEmpty ? (
        <AnalyticsEmptyState />
      ) : data ? (
        <div className="space-y-6">
          <RevenueByMonthChart data={data.revenueByMonth} />
          <div className="grid gap-4 lg:grid-cols-2">
            <RevenueByClientChart data={data.revenueByClient} />
            <TimeByClientChart data={data.hoursByClient} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
