"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ExpenseFiltersProps {
  clients: Array<{ id: string; name: string }>
}

const EXPENSE_CATEGORIES = [
  "SOFTWARE",
  "HARDWARE",
  "TRAVEL",
  "OFFICE",
  "MARKETING",
  "LEGAL",
  "OTHER",
] as const

export function ExpenseFilters({ clients }: ExpenseFiltersProps) {
  const t = useTranslations("expenses")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
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

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Select
        value={searchParams.get("category") ?? ""}
        onValueChange={(val) => updateFilter("category", val || null)}
      >
        <SelectTrigger
          className="w-[160px]"
          style={{ borderRadius: "19px 12px 12px 19px" }}
        >
          <SelectValue placeholder={t("allCategories")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t("allCategories")}</SelectItem>
          {EXPENSE_CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {t(`categories.${cat}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get("clientId") ?? ""}
        onValueChange={(val) => updateFilter("clientId", val || null)}
      >
        <SelectTrigger className="w-[160px]" style={{ borderRadius: "12px" }}>
          <SelectValue placeholder={t("allClients")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t("allClients")}</SelectItem>
          {clients.map((client) => (
            <SelectItem key={client.id} value={client.id}>
              {client.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        className="h-[38px] w-[150px] px-4"
        style={{ borderRadius: "12px" }}
        value={searchParams.get("dateFrom") ?? ""}
        onChange={(e) => updateFilter("dateFrom", e.target.value || null)}
        placeholder={t("dateFrom")}
      />

      <Input
        type="date"
        className="h-[38px] w-[150px] px-4"
        style={{ borderRadius: "12px 19px 19px 12px" }}
        value={searchParams.get("dateTo") ?? ""}
        onChange={(e) => updateFilter("dateTo", e.target.value || null)}
        placeholder={t("dateTo")}
      />
    </div>
  )
}
