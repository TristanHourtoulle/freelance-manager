"use client"

import { useCallback, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Chip } from "@/components/ui/chip-group"

const CATEGORIES = [
  { value: "FREELANCE", label: "Freelance" },
  { value: "STUDY", label: "Study" },
  { value: "PERSONAL", label: "Personal" },
  { value: "SIDE_PROJECT", label: "Side Project" },
] as const

/**
 * Pill-based category filter that syncs selected values to URL search params.
 * Uses the stadium-shape Chip component from the design system.
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
    <div className="flex flex-wrap items-center gap-2.5">
      {CATEGORIES.map((cat, index) => {
        const isActive = selected.includes(cat.value)
        return (
          <Chip
            key={cat.value}
            label={cat.label}
            isActive={isActive}
            onClick={() => toggle(cat.value)}
            position={
              index === 0
                ? "first"
                : index === CATEGORIES.length - 1
                  ? "last"
                  : "middle"
            }
          />
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
