"use client"

import { useEffect } from "react"

/**
 * Registers the PWA service worker on mount. No-op in development to avoid
 * interfering with Turbopack HMR, and on browsers without service worker
 * support. Renders nothing.
 */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  }, [])

  return null
}
