"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Select } from "@/components/ui/select"

const PERIOD_OPTIONS = [
  { value: "1m", label: "This month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "1y", label: "This year" },
  { value: "custom", label: "Custom range" },
]

/**
 * Dropdown selector for choosing an analytics time period.
 * Syncs the selected period (and optional custom date range) to URL search params.
 * Used on the analytics page.
 */
export function PeriodSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const period = searchParams.get("period") ?? "3m"

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handlePeriodChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", value)
    if (value !== "custom") {
      params.delete("from")
      params.delete("to")
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Period"
        value={period}
        onChange={(e) => handlePeriodChange(e.target.value)}
        options={PERIOD_OPTIONS}
      />
      {period === "custom" && (
        <>
          <div className="space-y-2">
            <label htmlFor="dateFrom">From</label>
            <input
              type="date"
              id="dateFrom"
              value={searchParams.get("from") ?? ""}
              onChange={(e) => updateParam("from", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="dateTo">To</label>
            <input
              type="date"
              id="dateTo"
              value={searchParams.get("to") ?? ""}
              onChange={(e) => updateParam("to", e.target.value)}
            />
          </div>
        </>
      )}
    </div>
  )
}
