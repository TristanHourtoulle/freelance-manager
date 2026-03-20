"use client"

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { useOnlineStatus } from "@/hooks/use-online-status"

/**
 * Displays a fixed banner at the top of the viewport when the browser is offline.
 */
export function OfflineBanner() {
  const { isOnline } = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <ExclamationTriangleIcon className="size-4 shrink-0" />
      <span>You are offline. Some features may be unavailable.</span>
    </div>
  )
}
