"use client"

import { lazy, Suspense, useEffect, useState, useCallback } from "react"
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

import type { DashboardKPIs } from "@/components/dashboard/types"
import type { OnboardingStatus } from "@/components/onboarding/types"

export default function DashboardPage() {
  const t = useTranslations("dashboard")
  const [data, setData] = useState<DashboardKPIs | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [isStale, setIsStale] = useState(false)
  const [enabledKpis, setEnabledKpis] = useState<DashboardKpiId[]>(
    DEFAULT_DASHBOARD_KPIS,
  )

  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null)
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)

      const [dashRes, onboardingRes, settingsRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/onboarding", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ])

      if (!cancelled) {
        if (dashRes.ok) {
          const json: DashboardKPIs = await dashRes.json()
          setData(json)
          setLastSyncedAt(json.lastSyncedAt)
          setIsStale(json.isStale)
        }

        if (settingsRes.ok) {
          const settings = await settingsRes.json()
          if (
            Array.isArray(settings.dashboardKpis) &&
            settings.dashboardKpis.length > 0
          ) {
            setEnabledKpis(settings.dashboardKpis as DashboardKpiId[])
          }
        }

        if (onboardingRes.ok) {
          const onboardingData: OnboardingStatus = await onboardingRes.json()
          setOnboarding(onboardingData)

          if (
            !onboardingData.allCompleted &&
            !localStorage.getItem("fm:welcome-dismissed")
          ) {
            setIsWelcomeOpen(true)
          }
        }

        setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const handleRefresh = useCallback(async () => {
    await fetch("/api/linear/refresh", { method: "POST" })
    setRefreshKey((k) => k + 1)
  }, [])

  const handleSaveKpis = useCallback(async (kpis: DashboardKpiId[]) => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dashboardKpis: kpis }),
    })
    if (res.ok) {
      setEnabledKpis(kpis)
    }
  }, [])

  const isEmpty =
    data !== null &&
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
        lastSyncedAt={lastSyncedAt}
        isStale={isStale}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      <OnboardingChecklist onboardingStatus={onboarding} />

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
            <KpiCustomizer enabledKpis={enabledKpis} onSave={handleSaveKpis} />
          </div>
          <KpiCardsGrid data={data} enabledKpis={enabledKpis} />
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
