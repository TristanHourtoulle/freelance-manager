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
            <label
              htmlFor="dateFrom"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              From
            </label>
            <input
              type="date"
              id="dateFrom"
              value={searchParams.get("from") ?? ""}
              onChange={(e) => updateParam("from", e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="dateTo"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              To
            </label>
            <input
              type="date"
              id="dateTo"
              value={searchParams.get("to") ?? ""}
              onChange={(e) => updateParam("to", e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
            />
          </div>
        </>
      )}
    </div>
  )
}
