import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"

interface RevenueTargetProgressProps {
  currentRevenue: number
  target: number
}

export function RevenueTargetProgress({
  currentRevenue,
  target,
}: RevenueTargetProgressProps) {
  if (target <= 0) return null

  const rawPercentage = Math.round((currentRevenue / target) * 100)
  const barWidth = Math.min(rawPercentage, 100)

  const color =
    rawPercentage < 50
      ? "var(--color-destructive)"
      : rawPercentage < 80
        ? "var(--color-warning)"
        : "var(--color-success)"

  return (
    <Card title="Revenue Target">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">
            {formatCurrency(currentRevenue)} / {formatCurrency(target)}
          </span>
          <span className="font-medium" style={{ color }}>
            {rawPercentage}%
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barWidth}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </Card>
  )
}
