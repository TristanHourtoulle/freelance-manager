"use client"

import { useSyncExternalStore } from "react"

const MOBILE_QUERY = "(max-width: 768px)"

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

function getServerSnapshot() {
  return false
}

/**
 * SSR-safe viewport hook returning true on phones (≤768px).
 *
 * Uses `useSyncExternalStore` so the first client render reads the
 * real viewport synchronously (no flicker, no useEffect race). The
 * server snapshot defaults to `false` (desktop) — combined with our
 * CSS-driven `.desktop-only` / `.mobile-only` switching, the shell
 * already matches the actual viewport before this hook resolves.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
