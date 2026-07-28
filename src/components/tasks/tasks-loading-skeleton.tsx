"use client"

import { Skeleton, SkeletonRow } from "@/components/ui/skeleton"

/**
 * Placeholder group cards shown while the first tasks page is loading, so the
 * true empty state never flashes during the initial fetch.
 */
export function TasksLoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }, (_, gi) => (
        <div
          key={gi}
          className="card"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <div
            className="row gap-12"
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-2)",
            }}
          >
            <Skeleton width={22} height={22} radius="var(--radius-sm)" />
            <div className="col gap-8">
              <Skeleton width={180} height={12} />
              <Skeleton width={120} height={10} />
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Skeleton width={80} height={14} />
            </div>
          </div>
          <div style={{ padding: "8px 18px" }}>
            {Array.from({ length: 4 }, (_, ri) => (
              <SkeletonRow key={ri} />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
