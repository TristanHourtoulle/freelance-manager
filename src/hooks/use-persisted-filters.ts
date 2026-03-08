import { useEffect, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

const STORAGE_KEY_PREFIX = "fm-filters:"

/**
 * Restores URL search params from localStorage on mount if no params are present,
 * and persists current params to localStorage on change.
 *
 * @param pageKey - Unique key per page (e.g. "tasks", "clients", "billing")
 * @param paramKeys - Which URL params to persist/restore
 */
export function usePersistedFilters(pageKey: string, paramKeys: string[]) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const hasRestored = useRef(false)

  useEffect(() => {
    if (hasRestored.current) return
    hasRestored.current = true

    const hasAnyParam = paramKeys.some((key) => searchParams.has(key))
    if (hasAnyParam) return

    try {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${pageKey}`)
      if (!stored) return

      const saved = JSON.parse(stored) as Record<string, string>
      const params = new URLSearchParams(searchParams.toString())
      let changed = false

      for (const key of paramKeys) {
        const value = saved[key]
        if (value) {
          params.set(key, value)
          changed = true
        }
      }

      if (changed) {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
      }
    } catch {
      // Ignore corrupted localStorage
    }
  }, [])

  useEffect(() => {
    const toSave: Record<string, string> = {}
    for (const key of paramKeys) {
      const value = searchParams.get(key)
      if (value) {
        toSave[key] = value
      }
    }

    try {
      if (Object.keys(toSave).length > 0) {
        localStorage.setItem(
          `${STORAGE_KEY_PREFIX}${pageKey}`,
          JSON.stringify(toSave),
        )
      } else {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${pageKey}`)
      }
    } catch {
      // Ignore storage errors
    }
  }, [pageKey, paramKeys, searchParams])
}
