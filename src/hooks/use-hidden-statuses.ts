import { useCallback, useState } from "react"

const STORAGE_KEY = "fm-hidden-statuses"

function loadHiddenIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return new Set()
    const parsed: unknown = JSON.parse(stored)
    if (Array.isArray(parsed)) return new Set(parsed as string[])
    return new Set()
  } catch {
    return new Set()
  }
}

function saveHiddenIds(ids: Set<string>): void {
  try {
    if (ids.size === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Manages hidden Linear workflow status IDs, persisted in localStorage.
 */
export function useHiddenStatuses() {
  const [hiddenStatusIds, setHiddenStatusIds] =
    useState<Set<string>>(loadHiddenIds)

  const toggleStatus = useCallback((statusId: string) => {
    setHiddenStatusIds((prev) => {
      const next = new Set(prev)
      if (next.has(statusId)) {
        next.delete(statusId)
      } else {
        next.add(statusId)
      }
      saveHiddenIds(next)
      return next
    })
  }, [])

  const showAll = useCallback(() => {
    setHiddenStatusIds(new Set())
    saveHiddenIds(new Set())
  }, [])

  return { hiddenStatusIds, toggleStatus, showAll }
}
