"use client"

import { Card } from "@/components/ui/card"

import type { Utilization } from "@/components/analytics/types"

interface UtilizationGaugeProps {
  utilization: Utilization
}

function getRateColor(rate: number): string {
  if (rate >= 100) return "text-destructive"
  if (rate >= 80) return "text-amber-500"
  return "text-green-600"
}

function getBarColor(rate: number): string {
  if (rate >= 100) return "bg-destructive"
  if (rate >= 80) return "bg-amber-500"
  return "bg-green-600"
}

/** Gauge card displaying the overall utilization rate as a percentage with a progress bar. Used on the analytics page. */
export function UtilizationGauge({ utilization }: UtilizationGaugeProps) {
  const clampedWidth = Math.min(utilization.rate, 100)

  return (
    <Card title="Utilization Rate">
      <div className="space-y-4">
        <p className={`text-4xl font-bold ${getRateColor(utilization.rate)}`}>
          {utilization.rate}%
        </p>

        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className={`h-full rounded-full transition-all ${getBarColor(utilization.rate)}`}
            style={{ width: `${clampedWidth}%` }}
          />
        </div>

        <p className="text-sm text-text-secondary">
          {utilization.totalBilledHours}h billed /{" "}
          {utilization.totalAvailableHours}h available
        </p>
      </div>
    </Card>
  )
}
