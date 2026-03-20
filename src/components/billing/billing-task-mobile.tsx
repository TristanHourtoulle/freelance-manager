"use client"

import { useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { formatCurrency } from "@/lib/format"

interface BillingTaskMobileProps {
  task: {
    id: string
    identifier: string
    title: string
    amount: number
    estimate?: number
  }
  selected: boolean
  onToggle: (id: string) => void
}

/**
 * Mobile-friendly billing task card with checkbox selection.
 * Compact layout optimized for touch interaction.
 */
export function BillingTaskMobile({
  task,
  selected,
  onToggle,
}: BillingTaskMobileProps) {
  const handleToggle = useCallback(() => {
    onToggle(task.id)
  }, [onToggle, task.id])

  return (
    <Card
      size="sm"
      className={`cursor-pointer transition-colors ${
        selected ? "ring-2 ring-primary/50" : ""
      }`}
      onClick={handleToggle}
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <Checkbox
          checked={selected}
          onCheckedChange={handleToggle}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select task ${task.identifier}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-text-muted">
              {task.identifier}
            </span>
            <span className="truncate text-sm text-foreground">
              {task.title}
            </span>
          </div>
          {task.estimate !== undefined && (
            <span className="text-xs text-text-muted">
              {task.estimate}h estimate
            </span>
          )}
        </div>
        <span className="shrink-0 text-sm font-semibold text-foreground">
          {formatCurrency(task.amount)}
        </span>
      </div>
    </Card>
  )
}
