"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Select } from "@/components/ui/select"

import type { ClientSummary } from "@/components/tasks/types"

interface HistoryFiltersProps {
  clients: ClientSummary[]
}

/**
 * Filter bar for the billing history page.
 * Provides client and date-range filters synced to URL search params.
 */
export function HistoryFilters({ clients }: HistoryFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const clientOptions = [
    { value: "", label: "All clients" },
    ...clients.map((c) => ({
      value: c.id,
      label: c.company ? `${c.name} (${c.company})` : c.name,
    })),
  ]

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select
        label="Client"
        value={searchParams.get("clientId") ?? ""}
        onChange={(e) => updateParam("clientId", e.target.value)}
        options={clientOptions}
      />
      <div className="space-y-2">
        <label htmlFor="dateFrom">From</label>
        <input
          type="date"
          id="dateFrom"
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => updateParam("dateFrom", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="dateTo">To</label>
        <input
          type="date"
          id="dateTo"
          value={searchParams.get("dateTo") ?? ""}
          onChange={(e) => updateParam("dateTo", e.target.value)}
        />
      </div>
    </div>
  )
}
