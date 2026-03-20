import { Skeleton } from "@/components/ui/skeleton"

interface PageSkeletonProps {
  variant: "list" | "grid" | "detail" | "form"
}

export function PageSkeleton({ variant }: PageSkeletonProps) {
  if (variant === "grid") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-surface p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === "list") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (variant === "detail") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </div>
    )
  }

  // form variant
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-48" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-[38px] rounded-[19px]" />
          <Skeleton className="h-[38px] rounded-[19px]" />
          <Skeleton className="h-[38px] rounded-[19px]" />
        </div>
      </div>
    </div>
  )
}
