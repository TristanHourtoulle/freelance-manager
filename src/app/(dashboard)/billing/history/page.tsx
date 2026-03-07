"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { HistoryFilters } from "@/components/billing/history-filters"
import { HistorySummary } from "@/components/billing/history-summary"
import { HistoryMonthList } from "@/components/billing/history-month-list"
import { Button } from "@/components/ui/button"

import type { ClientSummary } from "@/components/tasks/types"
import type {
  HistoryMonthGroup,
  HistoryApiResponse,
} from "@/components/billing/types"

export default function BillingHistoryPage() {
  const searchParams = useSearchParams()

  const [months, setMonths] = useState<HistoryMonthGroup[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      const res = await fetch(
        `/api/billing/history?${searchParams.toString()}`,
        {
          cache: "no-store",
        },
      )
      if (!cancelled && res.ok) {
        const data: HistoryApiResponse = await res.json()
        setMonths(data.months)
        setGrandTotal(data.grandTotal)
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

  const allClients: ClientSummary[] = useMemo(() => {
    const clientMap = new Map<string, ClientSummary>()
    for (const month of months) {
      for (const group of month.clients) {
        if (!clientMap.has(group.client.id)) {
          clientMap.set(group.client.id, group.client)
        }
      }
    }
    return [...clientMap.values()]
  }, [months])

  const totalTaskCount = useMemo(
    () => months.reduce((sum, m) => sum + m.taskCount, 0),
    [months],
  )

  const totalClientCount = useMemo(() => {
    const ids = new Set<string>()
    for (const month of months) {
      for (const group of month.clients) {
        ids.add(group.client.id)
      }
    }
    return ids.size
  }, [months])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Invoiced History</h1>
        <Link href="/billing">
          <Button variant="secondary">To Invoice</Button>
        </Link>
      </div>

      <HistoryFilters clients={allClients} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">
            Loading invoiced history...
          </p>
        </div>
      ) : months.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm text-text-secondary">
            No invoiced tasks found for the selected period.
          </p>
        </div>
      ) : (
        <>
          <HistorySummary
            monthCount={months.length}
            clientCount={totalClientCount}
            taskCount={totalTaskCount}
            grandTotal={grandTotal}
          />
          <HistoryMonthList months={months} />
        </>
      )}
    </div>
  )
}
