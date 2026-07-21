"use client"

import { useEffect, useRef } from "react"

interface UseInfiniteScrollOptions {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
  root?: Element | null
  rootMargin?: string
}

/**
 * Auto-loads the next page of an infinite list when a sentinel element nears
 * the bottom of its scroll container.
 *
 * The observer is created browser-only (inside `useEffect`) and is active only
 * while `hasNextPage && !isFetchingNextPage`. The scroll `root` defaults to the
 * sentinel's nearest `.m-content` ancestor (mobile) or the viewport (desktop);
 * pass `root` to override.
 *
 * @param options - `hasNextPage`/`isFetchingNextPage`/`fetchNextPage` from a
 * TanStack `useInfiniteQuery`; optional `root` override and `rootMargin`
 * (default `"200px"`, so the next page prefetches slightly before the bottom).
 * @returns A ref to attach to the sentinel `<div>`.
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  root,
  rootMargin = "200px",
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    if (!hasNextPage || isFetchingNextPage) return
    if (typeof IntersectionObserver === "undefined") return

    const resolvedRoot = root ?? node.closest(".m-content") ?? null
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage()
      },
      { root: resolvedRoot, rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, root, rootMargin])

  return sentinelRef
}
