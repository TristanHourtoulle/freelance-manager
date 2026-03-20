"use client"

import { lazy, Suspense, useState } from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { CategoryFilter } from "@/components/ui/category-filter"
import { PeriodSelector } from "@/components/analytics/period-selector"
import { AnalyticsSkeleton } from "@/components/analytics/analytics-skeleton"
import { AnalyticsEmptyState } from "@/components/analytics/analytics-empty-state"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useAnalytics } from "@/hooks/use-analytics"

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
  const [selectedClient, setSelectedClient] = useState<{
    id: string
    name: string
  } | null>(null)

  const { data, isLoading } = useAnalytics(searchParams.toString())

  // Reset selected client drill-down when search params change
  // (handled by React Query re-keying; selectedClient is local UI state)

  const isEmpty =
    data !== null &&
    data !== undefined &&
    data.revenueByMonth.every((m) => m.amount === 0) &&
    data.revenueByClient.every((c) => c.amount === 0) &&
    data.hoursByClient.every((c) => c.hours === 0) &&
    data.revenueByCategory.every((c) => c.amount === 0)

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <div className="flex flex-col gap-4">
        <PeriodSelector />
        <CategoryFilter />
      </div>

      {isLoading ? (
        <AnalyticsSkeleton />
      ) : isEmpty ? (
        <AnalyticsEmptyState />
      ) : data ? (
        <Suspense fallback={<AnalyticsSkeleton />}>
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Suspense fallback={<ChartFallback />}>
                <UtilizationGauge utilization={data.utilization} />
              </Suspense>
              <Suspense fallback={<ChartFallback />}>
                <UtilizationTrendChart data={data.utilization.byMonth} />
              </Suspense>
            </div>
            <Suspense fallback={<ChartFallback />}>
              <RevenueByMonthChart data={data.revenueByMonth} />
            </Suspense>
            <div className="grid gap-4 lg:grid-cols-2">
              <Suspense fallback={<ChartFallback />}>
                <RevenueByClientChart data={data.revenueByClient} />
              </Suspense>
              <Suspense fallback={<ChartFallback />}>
                <RevenueByCategoryChart data={data.revenueByCategory} />
              </Suspense>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Suspense fallback={<ChartFallback />}>
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
                    onClientClick={(id, name) =>
                      setSelectedClient({ id, name })
                    }
                  />
                )}
              </Suspense>
            </div>
          </div>
        </Suspense>
      ) : null}
    </div>
  )
}
