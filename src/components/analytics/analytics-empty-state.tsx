"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

/** Placeholder shown on the analytics page when no invoiced data exists for the selected period. */
export function AnalyticsEmptyState() {
  const t = useTranslations("analyticsCharts")

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input px-6 py-16">
      <p className="text-lg font-medium text-text-primary">{t("noData")}</p>
      <p className="mt-1 text-sm text-text-secondary">{t("noDataHint")}</p>
      <div className="mt-6 flex gap-3">
        <Link href="/billing">
          <Button>{t("goToBilling")}</Button>
        </Link>
        <Link href="/tasks">
          <Button variant="outline">{t("goToTasks")}</Button>
        </Link>
      </div>
    </div>
  )
}
