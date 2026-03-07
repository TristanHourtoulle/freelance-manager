"use client"

import { useEffect, useState, useCallback } from "react"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards-skeleton"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { RevenueChartSkeleton } from "@/components/dashboard/revenue-chart-skeleton"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import { RevenueTargetProgress } from "@/components/dashboard/revenue-target-progress"
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist"
import { WelcomeModal } from "@/components/onboarding/welcome-modal"
import { formatCurrency } from "@/lib/format"
import { SyncStatusBar } from "@/components/ui/sync-status-bar"

import type { DashboardKPIs } from "@/components/dashboard/types"
import type { OnboardingStatus } from "@/components/onboarding/types"

export default function DashboardPage() {
  const [data, setData] = useState<DashboardKPIs | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [isStale, setIsStale] = useState(false)

  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null)
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)

      const [dashRes, onboardingRes] = await Promise.all([
        fetch("/api/dashboard", { cache: "no-store" }),
        fetch("/api/onboarding", { cache: "no-store" }),
      ])

      if (!cancelled) {
        if (dashRes.ok) {
          const json: DashboardKPIs = await dashRes.json()
          setData(json)
          setLastSyncedAt(json.lastSyncedAt)
          setIsStale(json.isStale)
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

  const isEmpty =
    data !== null &&
    data.pipeline === 0 &&
    data.monthlyRevenue === 0 &&
    data.billedHours === 0 &&
    data.revenueByMonth.every((m) => m.amount === 0)

  return (
    <div className="space-y-6">
      <h1>Dashboard</h1>

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
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              title="Pipeline"
              value={formatCurrency(data.pipeline)}
              subtitle="To invoice"
            />
            <KpiCard
              title="Monthly Revenue"
              value={formatCurrency(data.monthlyRevenue)}
              subtitle="Current month"
            />
            <KpiCard
              title="Billed Hours"
              value={`${data.billedHours}h`}
              subtitle="Current month"
            />
          </div>
          {data.monthlyRevenueTarget > 0 && (
            <RevenueTargetProgress
              currentRevenue={data.monthlyRevenue}
              target={data.monthlyRevenueTarget}
            />
          )}
          <RevenueChart data={data.revenueByMonth} />
        </>
      ) : null}
    </div>
  )
}
