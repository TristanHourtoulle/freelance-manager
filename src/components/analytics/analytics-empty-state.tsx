import Link from "next/link"
import { Button } from "@/components/ui/button"

/** Placeholder shown on the analytics page when no invoiced data exists for the selected period. */
export function AnalyticsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-input px-6 py-16">
      <p className="text-lg font-medium text-text-primary">
        No invoiced data for the selected period
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Try selecting a different time range or mark some tasks as invoiced.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/billing">
          <Button>Go to Billing</Button>
        </Link>
        <Link href="/tasks">
          <Button variant="outline">Go to Tasks</Button>
        </Link>
      </div>
    </div>
  )
}
