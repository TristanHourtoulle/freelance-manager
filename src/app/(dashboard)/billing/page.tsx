"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { BillingFilters } from "@/components/billing/billing-filters"
import { BillingSummary } from "@/components/billing/billing-summary"
import { BillingGroupList } from "@/components/billing/billing-group-list"
import { BillingEmptyState } from "@/components/billing/billing-empty-state"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { TooltipHint } from "@/components/ui/tooltip-hint"
import { formatCurrency } from "@/lib/format"

import type { ClientTaskGroup, ClientSummary } from "@/components/tasks/types"
import type { BillingApiResponse } from "@/components/billing/types"

export default function BillingPage() {
  const searchParams = useSearchParams()

  const [groups, setGroups] = useState<ClientTaskGroup[]>([])
  const [grandTotal, setGrandTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isMarking, setIsMarking] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      const res = await fetch(`/api/billing?${searchParams.toString()}`, {
        cache: "no-store",
      })
      if (!cancelled && res.ok) {
        const data: BillingApiResponse = await res.json()
        setGroups(data.groups)
        setGrandTotal(data.grandTotal)
      }
      if (!cancelled) {
        setIsLoading(false)
        setSelectedIds(new Set())
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [searchParams, refreshKey])

  const handleToggleTask = useCallback((linearIssueId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(linearIssueId)) {
        next.delete(linearIssueId)
      } else {
        next.add(linearIssueId)
      }
      return next
    })
  }, [])

  const handleToggleGroup = useCallback(
    (_clientId: string, linearIssueIds: string[]) => {
      setSelectedIds((prev) => {
        const allSelected = linearIssueIds.every((id) => prev.has(id))
        const next = new Set(prev)
        if (allSelected) {
          for (const id of linearIssueIds) next.delete(id)
        } else {
          for (const id of linearIssueIds) next.add(id)
        }
        return next
      })
    },
    [],
  )

  const handleMarkInvoiced = useCallback(async () => {
    setIsMarking(true)
    const res = await fetch("/api/billing/mark-invoiced", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linearIssueIds: [...selectedIds] }),
    })
    if (res.ok) {
      setIsConfirmOpen(false)
      setSelectedIds(new Set())
      setRefreshKey((k) => k + 1)
    }
    setIsMarking(false)
  }, [selectedIds])

  const allClients: ClientSummary[] = useMemo(
    () => groups.map((g) => g.client),
    [groups],
  )

  const totalTaskCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.taskCount, 0),
    [groups],
  )

  const hasFilters = Boolean(
    searchParams.get("clientId") ||
    searchParams.get("category") ||
    searchParams.get("dateFrom") ||
    searchParams.get("dateTo"),
  )

  const selectedClientCount = useMemo(() => {
    return groups.filter((g) =>
      g.tasks.some((t) => selectedIds.has(t.linearIssueId)),
    ).length
  }, [groups, selectedIds])

  const selectedTotal = useMemo(() => {
    let total = 0
    for (const group of groups) {
      const selectedTasks = group.tasks.filter((t) =>
        selectedIds.has(t.linearIssueId),
      )
      if (selectedTasks.length === 0) continue

      if (group.client.billingMode === "FIXED") {
        total += group.client.rate
      } else {
        total += selectedTasks.reduce((sum, t) => sum + t.billingAmount, 0)
      }
    }
    return Math.round(total * 100) / 100
  }, [groups, selectedIds])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>To Invoice</h1>
        <div className="flex items-center gap-2">
          <Link href="/billing/history">
            <Button variant="secondary">History</Button>
          </Link>
          <Link href="/tasks">
            <Button variant="secondary">View Tasks</Button>
          </Link>
        </div>
      </div>

      <TooltipHint storageKey="billing-page">
        Flag tasks to invoice, then mark them as invoiced to track your revenue.
      </TooltipHint>

      <BillingFilters clients={allClients} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">Loading billing data...</p>
        </div>
      ) : groups.length === 0 ? (
        <BillingEmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <BillingSummary
            groupCount={groups.length}
            taskCount={totalTaskCount}
            grandTotal={grandTotal}
            selectedCount={selectedIds.size}
            onMarkInvoiced={() => setIsConfirmOpen(true)}
            isMarking={isMarking}
          />

          <BillingGroupList
            groups={groups}
            selectedIds={selectedIds}
            onToggleTask={handleToggleTask}
            onToggleGroup={handleToggleGroup}
          />
        </>
      )}

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleMarkInvoiced}
        title="Mark as invoiced"
        description={`You are about to mark ${selectedIds.size} task${selectedIds.size !== 1 ? "s" : ""} across ${selectedClientCount} client${selectedClientCount !== 1 ? "s" : ""} as invoiced (${formatCurrency(selectedTotal)}). This action can be undone from the Tasks page.`}
        confirmLabel="Mark as invoiced"
        isLoading={isMarking}
      />
    </div>
  )
}
