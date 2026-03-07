import Link from "next/link"
import { Button } from "@/components/ui/button"

interface ClientEmptyStateProps {
  hasFilters: boolean
}

export function ClientEmptyState({ hasFilters }: ClientEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-input py-16">
        <p className="text-sm text-text-secondary">
          No clients match your filters.
        </p>
        <p className="mt-1 text-sm text-text-muted">
          Try adjusting your search or category filter.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-input py-16">
      <p className="text-sm font-medium text-text-primary">No clients yet</p>
      <p className="mt-1 text-sm text-text-secondary">
        Create your first client to get started.
      </p>
      <Link href="/clients/new" className="mt-4">
        <Button>New Client</Button>
      </Link>
    </div>
  )
}
