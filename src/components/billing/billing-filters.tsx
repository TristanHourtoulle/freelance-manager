"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CategoryFilter } from "@/components/ui/category-filter"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"

import type { ClientSummary } from "@/components/tasks/types"

interface BillingFiltersProps {
  clients: ClientSummary[]
}

/**
 * Filter bar for the uninvoiced billing page.
 * Provides client, date-range, and category filters synced to URL search params.
 */
export function BillingFilters({ clients }: BillingFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  usePersistedFilters("billing", ["clientId", "category", "dateFrom", "dateTo"])

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete("page")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const clientId = searchParams.get("clientId") ?? ""

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Client
          </label>
          <Select
            value={clientId || undefined}
            onValueChange={(val) =>
              updateParam("clientId", val === "__all__" ? "" : (val ?? ""))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company ? `${c.name} (${c.company})` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      <CategoryFilter />
    </div>
  )
}
