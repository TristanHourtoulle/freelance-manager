import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Loading skeleton for the revenue chart card on the dashboard. */
export function RevenueChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue (6 months)</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full" />
      </CardContent>
    </Card>
  )
}
