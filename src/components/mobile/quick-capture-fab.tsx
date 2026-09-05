"use client"

import { usePathname } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { useOptionalQuickCapture } from "@/components/capture/quick-capture-provider"

const HIDDEN_ON_PREFIXES = ["/billing/new", "/tasks", "/quotes/new"]
const HIDDEN_ON_PATTERNS = [/^\/quotes\/[^/]+\/edit$/]

function isHiddenRoute(pathname: string): boolean {
  if (
    HIDDEN_ON_PREFIXES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
    return true
  }
  return HIDDEN_ON_PATTERNS.some((pattern) => pattern.test(pathname))
}

/**
 * Floating capture button for mobile.
 *
 * Hidden on the routes that render a `.sticky-cta` bar, which occupies the
 * same corner of the viewport.
 *
 * @returns The button, or `null` on a hidden route or without a provider.
 */
export function QuickCaptureFab() {
  const pathname = usePathname()
  const capture = useOptionalQuickCapture()

  if (!capture) return null
  if (isHiddenRoute(pathname)) {
    return null
  }

  return (
    <button
      type="button"
      className="fab"
      onClick={capture.open}
      aria-label="Nouvelle action"
    >
      <Icon name="plus" size={22} />
    </button>
  )
}
