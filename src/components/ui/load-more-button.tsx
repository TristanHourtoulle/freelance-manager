"use client"

import { Icon } from "@/components/ui/icon"

interface LoadMoreButtonProps {
  onClick: () => void
  isLoading: boolean
  hasMore: boolean
  label?: string
}

/**
 * "Charger plus" footer button for keyset-paginated lists. Renders nothing
 * when {@link LoadMoreButtonProps.hasMore} is false. Pair with TanStack
 * `useInfiniteQuery({ getNextPageParam })` — pass `fetchNextPage`,
 * `hasNextPage`, and `isFetchingNextPage`.
 */
export function LoadMoreButton({
  onClick,
  isLoading,
  hasMore,
  label = "Charger plus",
}: LoadMoreButtonProps) {
  if (!hasMore) return null
  return (
    <div
      className="row"
      style={{ justifyContent: "center", margin: "18px 0 4px" }}
    >
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onClick}
        disabled={isLoading}
      >
        <Icon
          name={isLoading ? "sync" : "chevron-down"}
          size={13}
          className={isLoading ? "spin" : ""}
        />
        {isLoading ? "Chargement…" : label}
      </button>
    </div>
  )
}
