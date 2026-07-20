"use client"

import { useLinearSyncWatcher } from "@/hooks/use-linear-sync"

/**
 * Headless mount point for the Linear sync watcher.
 *
 * Rendered once from the dashboard layout — shared by the desktop and mobile
 * shells — so a sync completes identically whatever triggered it (Tasks,
 * Projets, Réglages, ⌘K, or another tab).
 */
export function LinearSyncWatcher() {
  useLinearSyncWatcher()
  return null
}
