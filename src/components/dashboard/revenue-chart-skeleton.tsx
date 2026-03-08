import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Loading skeleton for the revenue chart card on the dashboard. */
export function RevenueChartSkeleton() {
  return (
    <Card title="Revenue (6 months)">
      <Skeleton className="h-64 w-full" />
    </Card>
  )
}
