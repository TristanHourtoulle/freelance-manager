import Link from "next/link"
import { Button } from "@/components/ui/button"

export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 px-6 py-16 dark:border-zinc-700">
      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        No data yet
      </p>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
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
