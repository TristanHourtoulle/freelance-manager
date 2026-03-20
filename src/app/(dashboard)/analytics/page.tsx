"use client"

import { lazy, Suspense, useState } from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { CategoryFilter } from "@/components/ui/category-filter"
import { PeriodSelector } from "@/components/analytics/period-selector"
import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useRevenueByMonth,
  useRevenueByClient,
  useHoursByClient,
  useRevenueByCategory,
  useUtilization,
} from "@/hooks/use-analytics"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"

const RevenueByMonthChart = lazy(() =>
  import("@/components/analytics/revenue-by-month-chart").then((m) => ({
    default: m.RevenueByMonthChart,
  })),
)
const RevenueByClientChart = lazy(() =>
  import("@/components/analytics/revenue-by-client-chart").then((m) => ({
    default: m.RevenueByClientChart,
  })),
)
const TimeByClientChart = lazy(() =>
  import("@/components/analytics/time-by-client-chart").then((m) => ({
    default: m.TimeByClientChart,
  })),
)
const TimeByProjectChart = lazy(() =>
  import("@/components/analytics/time-by-project-chart").then((m) => ({
    default: m.TimeByProjectChart,
  })),
)
const RevenueByCategoryChart = lazy(() =>
  import("@/components/analytics/revenue-by-category-chart").then((m) => ({
    default: m.RevenueByCategoryChart,
  })),
)
const UtilizationGauge = lazy(() =>
  import("@/components/analytics/utilization-gauge").then((m) => ({
    default: m.UtilizationGauge,
  })),
)
const UtilizationTrendChart = lazy(() =>
  import("@/components/analytics/utilization-trend-chart").then((m) => ({
    default: m.UtilizationTrendChart,
  })),
)

function ChartFallback() {
  return <Skeleton className="h-48 w-full rounded-xl sm:h-56 md:h-64" />
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics")
  const searchParams = useSearchParams()
  usePersistedFilters("analytics", ["period", "category"])
  const [selectedClient, setSelectedClient] = useState<{
    id: string
    name: string
  } | null>(null)

  const paramsString = searchParams.toString()

  const revenueByMonth = useRevenueByMonth(paramsString)
  const revenueByClient = useRevenueByClient(paramsString)
  const hoursByClient = useHoursByClient(paramsString)
  const revenueByCategory = useRevenueByCategory(paramsString)
  const utilization = useUtilization(paramsString)

  const isAllLoaded =
    !revenueByMonth.isLoading &&
    !revenueByClient.isLoading &&
    !hoursByClient.isLoading &&
    !revenueByCategory.isLoading &&
    !utilization.isLoading

  const isEmpty =
    isAllLoaded &&
    (revenueByMonth.data?.revenueByMonth?.every((m) => m.amount === 0) ??
      true) &&
    (revenueByClient.data?.revenueByClient?.every((c) => c.amount === 0) ??
      true) &&
    (hoursByClient.data?.hoursByClient?.every((c) => c.hours === 0) ?? true) &&
    (revenueByCategory.data?.revenueByCategory?.every((c) => c.amount === 0) ??
      true)

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <div className="flex flex-col gap-4">
        <PeriodSelector />
        <CategoryFilter />
      </div>

      {isAllLoaded && isEmpty ? (
        <AnalyticsEmptyState />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Suspense fallback={<ChartFallback />}>
              {utilization.isLoading ? (
                <ChartFallback />
              ) : utilization.data ? (
                <UtilizationGauge utilization={utilization.data.utilization} />
              ) : null}
            </Suspense>
            <Suspense fallback={<ChartFallback />}>
              {utilization.isLoading ? (
                <ChartFallback />
              ) : utilization.data ? (
                <UtilizationTrendChart
                  data={utilization.data.utilization.byMonth}
                />
              ) : null}
            </Suspense>
          </div>
          <Suspense fallback={<ChartFallback />}>
            {revenueByMonth.isLoading ? (
              <ChartFallback />
            ) : revenueByMonth.data ? (
              <RevenueByMonthChart data={revenueByMonth.data.revenueByMonth} />
            ) : null}
          </Suspense>
          <div className="grid gap-4 lg:grid-cols-2">
            <Suspense fallback={<ChartFallback />}>
              {revenueByClient.isLoading ? (
                <ChartFallback />
              ) : revenueByClient.data ? (
                <RevenueByClientChart
                  data={revenueByClient.data.revenueByClient}
                />
              ) : null}
            </Suspense>
            <Suspense fallback={<ChartFallback />}>
              {revenueByCategory.isLoading ? (
                <ChartFallback />
              ) : revenueByCategory.data ? (
                <RevenueByCategoryChart
                  data={revenueByCategory.data.revenueByCategory}
                />
              ) : null}
            </Suspense>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Suspense fallback={<ChartFallback />}>
              {hoursByClient.isLoading ? (
                <ChartFallback />
              ) : hoursByClient.data ? (
                selectedClient ? (
                  <TimeByProjectChart
                    clientId={selectedClient.id}
                    clientName={selectedClient.name}
                    period={searchParams.get("period") ?? "3m"}
                    searchParams={paramsString}
                    onBack={() => setSelectedClient(null)}
                  />
                ) : (
                  <TimeByClientChart
                    data={hoursByClient.data.hoursByClient}
                    onClientClick={(id, name) =>
                      setSelectedClient({ id, name })
                    }
                  />
                )
              ) : null}
            </Suspense>
          </div>
        </div>
      )}
    </div>
  )
}
