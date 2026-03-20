"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

interface TaskEmptyStateProps {
  hasFilters: boolean
}

/**
 * Placeholder shown on the tasks page when no tasks or Linear mappings exist.
 * @param hasFilters - Whether active filters are narrowing the result set.
 */
export function TaskEmptyState({ hasFilters }: TaskEmptyStateProps) {
  const t = useTranslations("emptyStates")

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input py-16">
        <p className="text-sm font-medium text-text-primary">
          {t("tasksFiltered")}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {t("tasksFilteredHint")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input py-16">
      <p className="text-sm font-medium text-text-primary">{t("tasksEmpty")}</p>
      <p className="mt-1 text-sm text-text-secondary">{t("tasksEmptyHint")}</p>
      <Link href="/clients" className="mt-4">
        <Button variant="outline">{t("goToClients")}</Button>
      </Link>
    </div>
  )
}
