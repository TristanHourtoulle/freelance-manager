"use client"

import { Icon } from "@/components/ui/icon"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"

interface InfiniteScrollSentinelProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  root?: Element | null
  rootMargin?: string
}

/**
 * Bottom-of-list sentinel that auto-loads the next page when scrolled into
 * view, replacing a manual "Charger plus" button. Renders nothing once there
 * is no next page and no fetch in flight.
 *
 * @param props - `hasNextPage`/`isFetchingNextPage`/`fetchNextPage` from a
 * TanStack `useInfiniteQuery`; optional `root`/`rootMargin` forwarded to
 * {@link useInfiniteScroll}.
 */
export function InfiniteScrollSentinel({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  root,
  rootMargin,
}: InfiniteScrollSentinelProps) {
  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    root,
    rootMargin,
  })

  if (!hasNextPage && !isFetchingNextPage) return null

  return (
    <div
      ref={sentinelRef}
      className="row"
      style={{ justifyContent: "center", margin: "18px 0 4px", minHeight: 1 }}
    >
      {isFetchingNextPage && (
        <span
          className="row gap-8"
          role="status"
          aria-live="polite"
          style={{ color: "var(--text-2)", fontSize: 12 }}
        >
          <Icon name="sync" size={13} className="spin" />
          Chargement…
        </span>
      )}
    </div>
  )
}
