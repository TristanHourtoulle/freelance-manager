"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { KpiCardsSkeleton } from "@/components/dashboard/kpi-cards-skeleton"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { RevenueChartSkeleton } from "@/components/dashboard/revenue-chart-skeleton"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import { formatCurrency } from "@/lib/format"

import type { DashboardKPIs } from "@/components/dashboard/types"

export default function DashboardPage() {
  const [data, setData] = useState<DashboardKPIs | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      const res = await fetch("/api/dashboard", { cache: "no-store" })
      if (!cancelled && res.ok) {
        const json: DashboardKPIs = await res.json()
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
  }, [])

  const isEmpty =
    data !== null &&
    data.pipeline === 0 &&
    data.monthlyRevenue === 0 &&
    data.billedHours === 0 &&
    data.revenueByMonth.every((m) => m.amount === 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h1>
        <div className="flex gap-2">
          <Link href="/clients">
            <Button variant="secondary">Clients</Button>
          </Link>
          <Link href="/tasks">
            <Button variant="secondary">Tasks</Button>
          </Link>
          <Link href="/billing">
            <Button variant="secondary">To Invoice</Button>
          </Link>
        </div>
      </div>

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
          <RevenueChart data={data.revenueByMonth} />
        </>
      ) : null}
    </div>
  )
}
