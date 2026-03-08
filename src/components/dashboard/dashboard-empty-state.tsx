import Link from "next/link"
import { Button } from "@/components/ui/button"

/** Placeholder shown on the dashboard when the user has no data yet. */
export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input px-6 py-16">
      <p className="text-lg font-medium text-text-primary">No data yet</p>
      <p className="mt-1 text-sm text-text-secondary">
        Start by adding clients and marking tasks as billable.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/clients">
          <Button>Go to Clients</Button>
        </Link>
        <Link href="/tasks">
          <Button variant="secondary">Go to Tasks</Button>
        </Link>
      </div>
    </div>
  )
}
