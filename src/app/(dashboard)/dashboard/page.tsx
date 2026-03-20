"use client"

import { lazy, Suspense, useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { KpiCustomizer } from "@/components/dashboard/kpi-customizer"
import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards-skeleton"
import { RevenueChartSkeleton } from "@/components/dashboard/revenue-chart-skeleton"

const RevenueChart = lazy(() =>
  import("@/components/dashboard/revenue-chart").then((m) => ({
    default: m.RevenueChart,
  })),
)
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import { RevenueTargetProgress } from "@/components/dashboard/revenue-target-progress"
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist"
import { WelcomeModal } from "@/components/onboarding/welcome-modal"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/ui/page-header"
import { SyncStatusBar } from "@/components/ui/sync-status-bar"
import {
  DEFAULT_DASHBOARD_KPIS,
  type DashboardKpiId,
} from "@/lib/schemas/settings"
import { useDashboard, useOnboarding } from "@/hooks/use-dashboard"

import type { DashboardKPIs } from "@/components/dashboard/types"

export default function DashboardPage() {
  const t = useTranslations("dashboard")
  const queryClient = useQueryClient()

  const {
    data,
    isLoading: isDashboardLoading,
    isFetching: isDashboardFetching,
  } = useDashboard()
  const { data: onboardingData } = useOnboarding()

  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)

  // KPI preferences come from the dashboard API response (merged from userSettings)
  const resolvedKpis: DashboardKpiId[] =
    data && Array.isArray(data.dashboardKpis) && data.dashboardKpis.length > 0
      ? (data.dashboardKpis as DashboardKpiId[])
      : DEFAULT_DASHBOARD_KPIS

  // Show welcome modal for first-time users
  if (
    onboardingData &&
    !onboardingData.allCompleted &&
    !isWelcomeOpen &&
    typeof window !== "undefined" &&
    !localStorage.getItem("fm:welcome-dismissed")
  ) {
    // Trigger in a microtask to avoid setting state during render
    queueMicrotask(() => setIsWelcomeOpen(true))
  }

  const handleRefresh = useCallback(async () => {
    await fetch("/api/linear/refresh", { method: "POST" })
    queryClient.invalidateQueries({ queryKey: ["dashboard"] })
  }, [queryClient])

  const handleSaveKpis = useCallback(
    async (kpis: DashboardKpiId[]) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboardKpis: kpis }),
      })
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      }
    },
    [queryClient],
  )

  const isLoading = isDashboardLoading

  const isEmpty =
    data !== null &&
    data !== undefined &&
    data.pipeline === 0 &&
    data.monthlyRevenue === 0 &&
    data.billedHours === 0 &&
    data.revenueByMonth.every((m) => m.amount === 0)

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <WelcomeModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
      />

      <SyncStatusBar
        lastSyncedAt={data?.lastSyncedAt ?? null}
        isStale={data?.isStale ?? false}
        onRefresh={handleRefresh}
        isRefreshing={isDashboardFetching}
      />

      <OnboardingChecklist onboardingStatus={onboardingData ?? null} />

      {isLoading ? (
        <>
          <KpiCardsSkeleton />
          <RevenueChartSkeleton />
        </>
      ) : isEmpty ? (
        <DashboardEmptyState />
      ) : data ? (
        <>
          <div className="flex items-center justify-between">
            <div />
            <KpiCustomizer enabledKpis={resolvedKpis} onSave={handleSaveKpis} />
          </div>
          <KpiCardsGrid data={data} enabledKpis={resolvedKpis} />
          {data.monthlyRevenueTarget > 0 && (
            <RevenueTargetProgress
              currentRevenue={data.monthlyRevenue}
              target={data.monthlyRevenueTarget}
            />
          )}
          <Suspense fallback={<RevenueChartSkeleton />}>
            <RevenueChart data={data.revenueByMonth} />
          </Suspense>
        </>
      ) : null}
    </div>
  )
}

/** Renders only the KPI cards that are enabled by user preferences. */
function KpiCardsGrid({
  data,
  enabledKpis,
}: {
  data: DashboardKPIs
  enabledKpis: DashboardKpiId[]
}) {
  const t = useTranslations("dashboard")

  const kpiDefinitions: Record<
    DashboardKpiId,
    { title: string; value: string; subtitle: string }
  > = {
    monthlyRevenue: {
      title: t("monthlyRevenue"),
      value: formatCurrency(data.monthlyRevenue),
      subtitle: t("currentMonth"),
    },
    pipeline: {
      title: t("pipeline"),
      value: formatCurrency(data.pipeline),
      subtitle: t("toInvoice"),
    },
    billedHours: {
      title: t("billedHours"),
      value: `${data.billedHours}h`,
      subtitle: t("currentMonth"),
    },
    activeClients: {
      title: t("activeClients"),
      value: String(data.activeClients),
      subtitle: t("currentMonth"),
    },
    overdueInvoices: {
      title: t("overdueInvoices"),
      value: String(data.overdueInvoices),
      subtitle: t("currentMonth"),
    },
    monthlyExpenses: {
      title: t("monthlyExpenses"),
      value: formatCurrency(data.monthlyExpenses),
      subtitle: t("currentMonth"),
    },
  }

  const visibleKpis = enabledKpis.filter((id) => id in kpiDefinitions)

  if (visibleKpis.length === 0) return null

  const gridCols =
    visibleKpis.length <= 3
      ? "sm:grid-cols-3"
      : visibleKpis.length <= 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3"

  return (
    <div className={`grid gap-4 ${gridCols}`}>
      {visibleKpis.map((kpiId) => {
        const kpi = kpiDefinitions[kpiId]
        return (
          <KpiCard
            key={kpiId}
            title={kpi.title}
            value={kpi.value}
            subtitle={kpi.subtitle}
          />
        )
      })}
    </div>
  )
}
