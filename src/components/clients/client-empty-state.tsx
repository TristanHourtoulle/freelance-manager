import Link from "next/link"
import { Button } from "@/components/ui/button"

interface ClientEmptyStateProps {
  hasFilters: boolean
}

export function ClientEmptyState({ hasFilters }: ClientEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No clients match your filters.
        </p>
        <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
          Try adjusting your search or category filter.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
        No clients yet
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Create your first client to get started.
      </p>
      <Link href="/clients/new" className="mt-4">
        <Button>New Client</Button>
      </Link>
    </div>
  )
}
