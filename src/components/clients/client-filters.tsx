"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Select } from "@/components/ui/select"

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "STUDY", label: "Study" },
  { value: "PERSONAL", label: "Personal" },
  { value: "SIDE_PROJECT", label: "Side Project" },
]

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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-2">
        <label
          htmlFor="search"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Search
        </label>
        <input
          id="search"
          type="text"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name or company..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        />
      </div>
      <div className="w-full sm:w-48">
        <Select
          label="Category"
          options={CATEGORY_OPTIONS}
          value={searchParams.get("category") ?? ""}
          onChange={(e) => updateParams("category", e.target.value)}
        />
      </div>
    </div>
  )
}
