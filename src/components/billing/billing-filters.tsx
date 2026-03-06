"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Select } from "@/components/ui/select"

import type { ClientSummary } from "@/components/tasks/types"

interface BillingFiltersProps {
  clients: ClientSummary[]
}

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "STUDY", label: "Study" },
  { value: "PERSONAL", label: "Personal" },
  { value: "SIDE_PROJECT", label: "Side Project" },
]

export function BillingFilters({ clients }: BillingFiltersProps) {
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
    params.delete("page")
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
      <Select
        label="Category"
        value={searchParams.get("category") ?? ""}
        onChange={(e) => updateParam("category", e.target.value)}
        options={CATEGORY_OPTIONS}
      />
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
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => updateParam("dateFrom", e.target.value)}
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
          value={searchParams.get("dateTo") ?? ""}
          onChange={(e) => updateParam("dateTo", e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-100 dark:focus:ring-zinc-100"
        />
      </div>
    </div>
  )
}
