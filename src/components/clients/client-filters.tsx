"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { CategoryFilter } from "@/components/ui/category-filter"
import { ViewToggle } from "@/components/clients/view-toggle"

const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "name:asc", label: "Name A-Z" },
  { value: "name:desc", label: "Name Z-A" },
  { value: "revenue:desc", label: "Revenue (high to low)" },
  { value: "lastActivity:desc", label: "Recent activity first" },
] as const

interface ClientFiltersProps {
  view: "grid" | "list"
  onViewChange: (view: "grid" | "list") => void
}

/**
 * Filter toolbar for the clients page.
 * Provides search, sort, category, archived toggle, and grid/list view switch.
 * All filter state is synced to URL search params.
 */
export function ClientFilters({ view, onViewChange }: ClientFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [searchValue, setSearchValue] = useState(
    searchParams.get("search") ?? "",
  )
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateParams("search", value.trim())
      }, 300)
    },
    [updateParams],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const currentSort = `${searchParams.get("sortBy") ?? "createdAt"}:${searchParams.get("sortOrder") ?? "desc"}`

  function handleSortChange(combined: string) {
    const parts = combined.split(":")
    const sortBy = parts[0] ?? "createdAt"
    const sortOrder = parts[1] ?? "desc"
    const params = new URLSearchParams(searchParams.toString())
    params.set("sortBy", sortBy)
    params.set("sortOrder", sortOrder)
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="text"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or company..."
          />
        </div>
        <div className="flex items-end gap-3 self-end">
          <div className="space-y-2">
            <label htmlFor="sort" className="text-sm text-text-secondary">
              Sort
            </label>
            <select
              id="sort"
              value={currentSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <ViewToggle view={view} onViewChange={onViewChange} />
          <label className="flex cursor-pointer items-center gap-2 pb-1 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={searchParams.get("archived") === "true"}
              onChange={(e) =>
                updateParams("archived", e.target.checked ? "true" : "")
              }
              className="rounded border-border"
            />
            Show archived
          </label>
        </div>
      </div>
      <CategoryFilter />
    </div>
  )
}
