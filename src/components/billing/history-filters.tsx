"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePersistedFilters } from "@/hooks/use-persisted-filters"

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
  const t = useTranslations("billingHistory")

  usePersistedFilters("billing-history", ["clientId", "dateFrom", "dateTo"])

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const clientId = searchParams.get("clientId") ?? ""

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">
          {t("clientLabel")}
        </label>
        <Select
          value={clientId || undefined}
          onValueChange={(val) =>
            updateParam("clientId", val === "__all__" ? "" : (val ?? ""))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t("allClients")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allClients")}</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.company ? `${c.name} (${c.company})` : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label htmlFor="dateFrom">{t("fromLabel")}</label>
        <input
          type="date"
          id="dateFrom"
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => updateParam("dateFrom", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="dateTo">{t("toLabel")}</label>
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
