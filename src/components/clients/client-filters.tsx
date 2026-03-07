"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { CategoryFilter } from "@/components/ui/category-filter"

export function ClientFilters() {
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
        <label className="flex cursor-pointer items-center gap-2 self-end pb-1 text-sm text-text-secondary">
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
      <CategoryFilter />
    </div>
  )
}
