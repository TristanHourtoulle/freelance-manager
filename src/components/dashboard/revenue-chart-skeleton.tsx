import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function RevenueChartSkeleton() {
  return (
    <Card title="Revenue (6 months)">
      <Skeleton className="h-64 w-full" />
    </Card>
  )
}
