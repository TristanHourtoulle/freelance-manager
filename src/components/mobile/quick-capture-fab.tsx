"use client"

import { usePathname } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { useOptionalQuickCapture } from "@/components/capture/quick-capture-provider"

const HIDDEN_ON = ["/billing/new", "/tasks"]

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
  if (
    HIDDEN_ON.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    )
  ) {
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
