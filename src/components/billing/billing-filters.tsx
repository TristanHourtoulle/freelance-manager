"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { CategoryFilter } from "@/components/ui/category-filter"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"

import type { ClientSummary } from "@/components/tasks/types"

interface BillingFiltersProps {
  clients: ClientSummary[]
}

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
      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          value={clientId || undefined}
          onValueChange={(val) =>
            updateParam("clientId", val === "__all__" ? "" : (val ?? ""))
          }
        >
          <SelectTrigger
            className="h-[38px] w-auto border-border bg-surface px-5 text-sm font-medium text-text-secondary"
            style={{ borderRadius: "19px 12px 12px 19px" }}
          >
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
        <Input
          type="date"
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => updateParam("dateFrom", e.target.value)}
          className="h-[38px] w-auto"
          style={{ borderRadius: "12px" }}
        />
        <Input
          type="date"
          value={searchParams.get("dateTo") ?? ""}
          onChange={(e) => updateParam("dateTo", e.target.value)}
          className="h-[38px] w-auto"
          style={{ borderRadius: "12px 19px 19px 12px" }}
        />
      </div>
      <CategoryFilter />
    </div>
  )
}
