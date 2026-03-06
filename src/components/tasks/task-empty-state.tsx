import Link from "next/link"
import { Button } from "@/components/ui/button"

interface TaskEmptyStateProps {
  hasFilters: boolean
}

export function TaskEmptyState({ hasFilters }: TaskEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          No tasks match your filters
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
        No Linear mappings configured
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Set up Linear project mappings on your clients to see tasks here.
      </p>
      <Link href="/clients" className="mt-4">
        <Button variant="secondary">Go to Clients</Button>
      </Link>
    </div>
  )
}
