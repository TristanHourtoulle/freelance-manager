"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

/** Placeholder shown on the dashboard when the user has no data yet. */
export function DashboardEmptyState() {
  const t = useTranslations("emptyStates")

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input px-6 py-16">
      <p className="text-lg font-medium text-text-primary">
        {t("dashboardEmpty")}
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        {t("dashboardEmptyHint")}
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/clients">
          <Button>{t("goToClients")}</Button>
        </Link>
        <Link href="/tasks">
          <Button variant="outline">{t("goToTasks")}</Button>
        </Link>
      </div>
    </div>
  )
}
