import Link from "next/link"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

interface ClientEmptyStateProps {
  hasFilters: boolean
}

/**
 * Placeholder shown on the clients page when no clients exist or match current filters.
 * @param hasFilters - Whether active filters are narrowing the result set.
 */
export function ClientEmptyState({ hasFilters }: ClientEmptyStateProps) {
  const t = useTranslations("emptyStates")
  const tc = useTranslations("clients")

  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-input py-16">
        <p className="text-sm text-text-secondary">{t("clientsFiltered")}</p>
        <p className="mt-1 text-sm text-text-muted">
          {t("clientsFilteredHint")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-input py-16">
      <p className="text-sm font-medium text-text-primary">
        {t("clientsEmpty")}
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        {t("clientsEmptyHint")}
      </p>
      <Link href="/clients/new" className="mt-4">
        <Button>{tc("newClient")}</Button>
      </Link>
    </div>
  )
}
