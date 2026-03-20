"use client"

import { useState, useCallback, useMemo } from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { BillingFilters } from "@/components/billing/billing-filters"
import { BillingSummary } from "@/components/billing/billing-summary"
import { BillingGroupList } from "@/components/billing/billing-group-list"
import { BillingEmptyState } from "@/components/billing/billing-empty-state"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { TooltipHint } from "@/components/ui/tooltip-hint"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { useToast } from "@/components/providers/toast-provider"
import { useBilling, useMarkInvoiced } from "@/hooks/use-billing"
import { formatCurrency } from "@/lib/format"

import type { ClientSummary } from "@/components/tasks/types"

export default function BillingPage() {
  const t = useTranslations("billing")
  const tc = useTranslations("common")
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const { data, isLoading, isFetching } = useBilling(searchParams.toString())
  const markInvoicedMutation = useMarkInvoiced()

  const groups = data?.groups ?? []
  const grandTotal = data?.grandTotal ?? 0

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

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
    markInvoicedMutation.mutate([...selectedIds], {
      onSuccess: (data) => {
        toast({
          variant: "success",
          title: t("toasts.success", { count: selectedIds.size }),
        })
        setIsConfirmOpen(false)
        setSelectedIds(new Set())
      },
      onError: () => {
        toast({ variant: "error", title: t("toasts.error") })
      },
    })
  }, [selectedIds, markInvoicedMutation, toast, t])

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
      <PageHeader title={t("title")}>
        <Link href="/billing/history">
          <Button variant="outline" shape="pill-left" size="lg">
            {t("history")}
          </Button>
        </Link>
        <Link href="/tasks">
          <Button variant="outline" shape="pill-right" size="lg">
            {t("viewTasks")}
          </Button>
        </Link>
      </PageHeader>

      <TooltipHint storageKey="billing-page">{t("hint")}</TooltipHint>

      <BillingFilters clients={allClients} />

      {isLoading ? (
        <PageSkeleton variant="list" />
      ) : groups.length === 0 ? (
        <BillingEmptyState hasFilters={hasFilters} />
      ) : (
        <div
          className={
            isFetching ? "opacity-50 transition-opacity" : "transition-opacity"
          }
        >
          <BillingSummary
            groupCount={groups.length}
            taskCount={totalTaskCount}
            grandTotal={grandTotal}
            selectedCount={selectedIds.size}
            onMarkInvoiced={() => setIsConfirmOpen(true)}
            isMarking={markInvoicedMutation.isPending}
          />

          <BillingGroupList
            groups={groups}
            selectedIds={selectedIds}
            onToggleTask={handleToggleTask}
            onToggleGroup={handleToggleGroup}
          />
        </div>
      )}

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleMarkInvoiced}
        title={t("markAsInvoiced")}
        description={`You are about to mark ${selectedIds.size} task${selectedIds.size !== 1 ? "s" : ""} across ${selectedClientCount} client${selectedClientCount !== 1 ? "s" : ""} as invoiced (${formatCurrency(selectedTotal)}). This action can be undone from the Tasks page.`}
        confirmLabel={t("markAsInvoiced")}
        isLoading={markInvoicedMutation.isPending}
      />
    </div>
  )
}
