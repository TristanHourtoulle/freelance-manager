import Link from "next/link"
import { Button } from "@/components/ui/button"

export function AnalyticsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 py-16 dark:border-zinc-700">
      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        No invoiced data for the selected period
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Try selecting a different time range or mark some tasks as invoiced.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/billing">
          <Button>Go to Billing</Button>
        </Link>
        <Link href="/tasks">
          <Button variant="secondary">Go to Tasks</Button>
        </Link>
      </div>
    </div>
  )
}
