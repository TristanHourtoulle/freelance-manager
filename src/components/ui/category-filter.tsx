"use client"

import { useCallback, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

const CATEGORIES = [
  { value: "FREELANCE", label: "Freelance" },
  { value: "STUDY", label: "Study" },
  { value: "PERSONAL", label: "Personal" },
  { value: "SIDE_PROJECT", label: "Side Project" },
] as const

/**
 * Pill-based category filter that syncs selected values to URL search params.
 * Supports multi-select with a clear-all action. Resets pagination on change.
 * Used on the projects list page to filter by project category.
 */
export function CategoryFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selected = useMemo(
    () => searchParams.get("category")?.split(",") ?? [],
    [searchParams],
  )

  const updateCategories = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next.length > 0) {
        params.set("category", next.join(","))
      } else {
        params.delete("category")
      }
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const toggle = useCallback(
    (value: string) => {
      const next = selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
      updateCategories(next)
    },
    [selected, updateCategories],
  )

  const clear = useCallback(() => {
    updateCategories([])
  }, [updateCategories])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-text-secondary">Category:</span>
      {CATEGORIES.map((cat) => {
        const isActive = selected.includes(cat.value)
        return (
          <button
            key={cat.value}
            type="button"
            onClick={() => toggle(cat.value)}
            className={`cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors ${
              isActive
                ? "border-primary bg-primary text-white hover:bg-primary/80"
                : "border-border bg-surface text-text-secondary hover:border-primary hover:bg-surface-muted hover:text-primary"
            }`}
          >
            {cat.label}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={clear}
          className="cursor-pointer text-sm text-text-secondary underline hover:text-primary"
        >
          Clear
        </button>
      )}
    </div>
  )
}
