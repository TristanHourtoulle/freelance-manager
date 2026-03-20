"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Chip } from "@/components/ui/chip-group"

const PERIOD_OPTION_KEYS: readonly { value: string; key: string }[] = [
  { value: "1m", key: "thisMonth" },
  { value: "3m", key: "threeMonths" },
  { value: "6m", key: "sixMonths" },
  { value: "1y", key: "thisYear" },
]

export function PeriodSelector() {
  const t = useTranslations("analytics.periods")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const period = searchParams.get("period") ?? "3m"

  function handlePeriodChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("period", value)
    params.delete("from")
    params.delete("to")
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {PERIOD_OPTION_KEYS.map((opt, index) => (
        <Chip
          key={opt.value}
          label={t(opt.key)}
          isActive={period === opt.value}
          onClick={() => handlePeriodChange(opt.value)}
          position={
            PERIOD_OPTION_KEYS.length === 1
              ? "only"
              : index === 0
                ? "first"
                : index === PERIOD_OPTION_KEYS.length - 1
                  ? "last"
                  : "middle"
          }
        />
      ))}
    </div>
  )
}
