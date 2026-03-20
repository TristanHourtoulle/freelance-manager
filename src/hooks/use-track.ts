"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Tracks page views by sending a fire-and-forget POST to /api/metrics
 * on each pathname change. Errors are silently swallowed to avoid
 * impacting the user experience.
 */
export function usePageTrack() {
  const pathname = usePathname()

  useEffect(() => {
    fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "page_view", page: pathname }),
    }).catch(() => {
      // Swallow errors - tracking must never block the UI
    })
  }, [pathname])
}
