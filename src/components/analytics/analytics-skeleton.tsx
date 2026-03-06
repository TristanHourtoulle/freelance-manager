import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Card title="Revenue by Month">
        <Skeleton className="h-64 w-full" />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Revenue by Client">
          <Skeleton className="h-64 w-full" />
        </Card>
        <Card title="Time by Client">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    </div>
  )
}
