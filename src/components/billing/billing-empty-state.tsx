import Link from "next/link"
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
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input py-16">
        <p className="text-sm font-medium text-text-primary">
          No uninvoiced tasks match your filters
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Try adjusting or clearing your filters.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input py-16">
      <p className="text-sm font-medium text-text-primary">
        Nothing to invoice
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Mark tasks as billable from the Tasks page to see them here.
      </p>
      <Link href="/tasks" className="mt-4">
        <Button variant="outline">Go to Tasks</Button>
      </Link>
    </div>
  )
}
