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

/**
 * Summary bar showing aggregate billing stats (clients, tasks, grand total) and a
 * "Mark as invoiced" action button. Used on the billing page.
 */
export function BillingSummary({
  groupCount,
  taskCount,
  grandTotal,
  selectedCount,
  onMarkInvoiced,
  isMarking,
}: BillingSummaryProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-5 py-4">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Clients
          </p>
          <p className="text-lg font-semibold tabular-nums text-text-primary">
            {groupCount}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Tasks
          </p>
          <p className="text-lg font-semibold tabular-nums text-text-primary">
            {taskCount}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Grand Total
          </p>
          <p className="text-2xl font-bold tabular-nums text-text-primary">
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
