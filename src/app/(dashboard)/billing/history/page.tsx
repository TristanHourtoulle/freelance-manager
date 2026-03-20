"use client"

import { useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { HistoryFilters } from "@/components/billing/history-filters"
import { HistorySummary } from "@/components/billing/history-summary"
import { HistoryMonthList } from "@/components/billing/history-month-list"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PageToolbar } from "@/components/ui/page-toolbar"
import { useToast } from "@/components/providers/toast-provider"
import { useBillingHistory, useUpdateInvoiceStatus } from "@/hooks/use-billing"

import type { ClientSummary } from "@/components/tasks/types"

export default function BillingHistoryPage() {
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const t = useTranslations("billingHistory")
  const tEmpty = useTranslations("emptyStates")

  const { data, isLoading } = useBillingHistory(searchParams.toString())
  const updateStatusMutation = useUpdateInvoiceStatus()

  const months = data?.months ?? []
  const grandTotal = data?.grandTotal ?? 0

  const handleUpdateStatus = useCallback(
    (invoiceId: string, status: "DRAFT" | "SENT" | "PAID") => {
      updateStatusMutation.mutate(
        { invoiceId, status },
        {
          onSuccess: () => {
            toast({
              variant: "success",
              title: t("statusUpdated"),
            })
          },
          onError: () => {
            toast({
              variant: "error",
              title: t("statusUpdateError"),
            })
          },
        },
      )
    },
    [updateStatusMutation, toast, t],
  )

  const handleMarkAsPaid = useCallback(
    (invoiceId: string) => {
      handleUpdateStatus(invoiceId, "PAID")
    },
    [handleUpdateStatus],
  )

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
      <PageHeader title={t("title")}>
        <Link href="/billing">
          <Button variant="outline">{t("backToInvoice")}</Button>
        </Link>
      </PageHeader>

      <PageToolbar>
        <HistoryFilters clients={allClients} />
      </PageToolbar>

      {isLoading ? (
        <PageSkeleton variant="list" />
      ) : months.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm text-text-secondary">
            {tEmpty("historyEmpty")}
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
          <HistoryMonthList
            months={months}
            onMarkAsPaid={handleMarkAsPaid}
            onUpdateStatus={handleUpdateStatus}
          />
        </>
      )}
    </div>
  )
}
