import Link from "next/link"
import { Button } from "@/components/ui/button"

interface BillingEmptyStateProps {
  hasFilters: boolean
}

export function BillingEmptyState({ hasFilters }: BillingEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          No uninvoiced tasks match your filters
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Try adjusting or clearing your filters.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        Nothing to invoice
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Mark tasks as billable from the Tasks page to see them here.
      </p>
      <Link href="/tasks" className="mt-4">
        <Button variant="secondary">Go to Tasks</Button>
      </Link>
    </div>
  )
}
