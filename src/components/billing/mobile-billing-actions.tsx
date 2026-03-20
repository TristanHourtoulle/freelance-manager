"use client"

import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"

interface MobileBillingActionsProps {
  selectedCount: number
  totalAmount: number
  onMarkInvoiced: () => void
  isLoading?: boolean
}

/**
 * Sticky bottom action bar for mobile billing.
 * Shows selected task count, total amount, and a "Mark Invoiced" button.
 * Only visible below md breakpoint.
 */
export function MobileBillingActions({
  selectedCount,
  totalAmount,
  onMarkInvoiced,
  isLoading = false,
}: MobileBillingActionsProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/80 backdrop-blur-lg md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {selectedCount} task{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <span className="text-xs text-text-muted">
            {formatCurrency(totalAmount)}
          </span>
        </div>
        <Button
          variant="gradient"
          shape="pill"
          size="lg"
          onClick={onMarkInvoiced}
          disabled={isLoading}
        >
          {isLoading ? "Marking..." : "Mark Invoiced"}
        </Button>
      </div>
    </div>
  )
}
