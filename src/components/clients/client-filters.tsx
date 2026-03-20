"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CategoryFilter } from "@/components/ui/category-filter"
import { ViewToggle } from "@/components/clients/view-toggle"
import { Checkbox } from "@/components/ui/checkbox"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"

const SORT_OPTION_KEYS = [
  { value: "createdAt:desc", key: "newestFirst" },
  { value: "createdAt:asc", key: "oldestFirst" },
  { value: "name:asc", key: "nameAZ" },
  { value: "name:desc", key: "nameZA" },
  { value: "revenue:desc", key: "revenueHighToLow" },
  { value: "lastActivity:desc", key: "recentActivity" },
] as const

interface ClientFiltersProps {
  view: "grid" | "list"
  onViewChange: (view: "grid" | "list") => void
}

export function ClientFilters({ view, onViewChange }: ClientFiltersProps) {
  const t = useTranslations("clients")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  usePersistedFilters("clients", [
    "sortBy",
    "sortOrder",
    "category",
    "archived",
  ])

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
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-[38px] pl-8"
          />
        </div>
        <div className="flex items-center gap-2.5">
          <Select
            value={currentSort}
            onValueChange={(val) => {
              if (val) handleSortChange(val)
            }}
          >
            <SelectTrigger className="h-[38px] w-auto border-border bg-surface px-4 text-sm font-medium text-text-secondary">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTION_KEYS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {t(`sortOptions.${opt.key}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={searchParams.get("archived") === "true"}
              onCheckedChange={(checked) =>
                updateParams("archived", checked ? "true" : "")
              }
            />
            {t("archived")}
          </label>
          <ViewToggle view={view} onViewChange={onViewChange} />
        </div>
      </div>
      <CategoryFilter />
    </div>
  )
}
