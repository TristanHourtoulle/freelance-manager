import Link from "next/link"
import { Button } from "@/components/ui/button"

interface TaskEmptyStateProps {
  hasFilters: boolean
}

/**
 * Placeholder shown on the tasks page when no tasks or Linear mappings exist.
 * @param hasFilters - Whether active filters are narrowing the result set.
 */
export function TaskEmptyState({ hasFilters }: TaskEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input py-16">
        <p className="text-sm font-medium text-text-primary">
          No tasks match your filters
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
        No Linear mappings configured
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Set up Linear project mappings on your clients to see tasks here.
      </p>
      <Link href="/clients" className="mt-4">
        <Button variant="outline">Go to Clients</Button>
      </Link>
    </div>
  )
}
