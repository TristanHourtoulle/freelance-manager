import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Loading skeleton for the KPI cards row on the dashboard. */
export function KpiCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-20" />
        </Card>
      ))}
    </div>
  )
}
