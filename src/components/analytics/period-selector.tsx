"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Chip } from "@/components/ui/chip-group"

const PERIOD_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "1m", label: "This month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "This year" },
]

export function PeriodSelector() {
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
      {PERIOD_OPTIONS.map((opt, index) => (
        <Chip
          key={opt.value}
          label={opt.label}
          isActive={period === opt.value}
          onClick={() => handlePeriodChange(opt.value)}
          position={
            PERIOD_OPTIONS.length === 1
              ? "only"
              : index === 0
                ? "first"
                : index === PERIOD_OPTIONS.length - 1
                  ? "last"
                  : "middle"
          }
        />
      ))}
    </div>
  )
}
