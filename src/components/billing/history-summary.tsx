"use client"

interface HistorySummaryProps {
  monthCount: number
  clientCount: number
  taskCount: number
  grandTotal: number
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

export function HistorySummary({
  monthCount,
  clientCount,
  taskCount,
  grandTotal,
}: HistorySummaryProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-5 py-4">
      <div className="flex items-center gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Months
          </p>
          <p className="text-lg font-semibold tabular-nums text-text-primary">
            {monthCount}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Clients
          </p>
          <p className="text-lg font-semibold tabular-nums text-text-primary">
            {clientCount}
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
    </div>
  )
}
