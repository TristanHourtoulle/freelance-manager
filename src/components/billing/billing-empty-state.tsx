import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

interface BillingEmptyStateProps {
  hasFilters: boolean
}

/**
 * Placeholder shown on the billing page when no uninvoiced tasks exist.
 * Renders a different message depending on whether filters are active.
 * @param hasFilters - Whether active filters are narrowing the result set.
 */
export function BillingEmptyState({ hasFilters }: BillingEmptyStateProps) {
  const t = useTranslations("emptyStates")

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input py-16">
        <p className="text-sm font-medium text-text-primary">
          {t("billingFiltered")}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {t("billingFilteredHint")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input py-16">
      <p className="text-sm font-medium text-text-primary">
        {t("billingEmpty")}
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        {t("billingEmptyHint")}
      </p>
      <Link href="/tasks" className="mt-4">
        <Button variant="outline">{t("goToTasks")}</Button>
      </Link>
    </div>
  )
}
