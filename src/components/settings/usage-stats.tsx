"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface MetricsData {
  totalEvents: number
  eventCounts: Record<string, number>
  topPages: Array<{ page: string; count: number }>
  period: string
}

/**
 * Displays aggregated usage statistics for the current user.
 * Fetches the last 30 days of metrics from /api/metrics.
 */
export function UsageStats() {
  const [data, setData] = useState<MetricsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/metrics?period=30d")
        if (response.ok) {
          const json: MetricsData = (await response.json()) as MetricsData
          setData(json)
        }
      } catch {
        // Silently fail - stats are non-critical
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  if (isLoading) {
    return (
      <Card className="rounded-xl border border-border bg-surface p-6">
        <CardHeader className="p-0 pb-4">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3 p-0">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-36" />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return null
  }

  const pageViews = data.eventCounts["page_view"] ?? 0
  const maxCount = data.topPages[0]?.count ?? 1

  return (
    <Card className="rounded-xl border border-border bg-surface p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-base font-semibold">
          Usage Stats (Last 30 days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{pageViews}</span>
          <span className="text-sm text-muted-foreground">page views</span>
        </div>

        {data.topPages.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Most visited pages
            </p>
            <div className="space-y-1.5">
              {data.topPages.slice(0, 5).map(({ page, count }) => (
                <div key={page} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate max-w-[200px]">{page}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.topPages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No usage data recorded yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
