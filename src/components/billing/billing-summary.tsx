"use client"

import { Button } from "@/components/ui/button"

interface BillingSummaryProps {
  groupCount: number
  taskCount: number
  grandTotal: number
  selectedCount: number
  onMarkInvoiced: () => void
  isMarking: boolean
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

export function BillingSummary({
  groupCount,
  taskCount,
  grandTotal,
  selectedCount,
  onMarkInvoiced,
  isMarking,
}: BillingSummaryProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Clients
          </p>
          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {groupCount}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Tasks
          </p>
          <p className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {taskCount}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Grand Total
          </p>
          <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatAmount(grandTotal)}
          </p>
        </div>
      </div>
      <Button
        onClick={onMarkInvoiced}
        disabled={selectedCount === 0}
        isLoading={isMarking}
      >
        Mark as invoiced ({selectedCount})
      </Button>
    </div>
  )
}
