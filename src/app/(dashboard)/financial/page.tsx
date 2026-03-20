"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { PnlTable } from "@/components/financial/pnl-table"
import { PnlChart } from "@/components/financial/pnl-chart"
import { ProjectionCard } from "@/components/financial/projection-card"
import { useFinancial } from "@/hooks/use-financial"
import { CurrencyDollarIcon } from "@heroicons/react/24/outline"

type PeriodType = "month" | "quarter" | "year"

export default function FinancialPage() {
  const t = useTranslations("financial")
  const [period, setPeriod] = useState<PeriodType>("month")
  const [year, setYear] = useState(new Date().getFullYear())

  const { data, isLoading, error } = useFinancial(
    period as "month" | "quarter" | "year",
    year,
  )

  const currentYear = new Date().getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        <div className="flex items-center gap-2.5">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-[38px] rounded-lg border border-border bg-surface px-3 text-sm"
            style={{ borderRadius: "19px 12px 12px 19px" }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <div className="flex">
            <button
              onClick={() => setPeriod("month")}
              className={`h-[38px] px-4 text-sm font-medium border transition-colors ${
                period === "month"
                  ? "bg-primary text-white border-primary"
                  : "bg-surface border-border text-text-secondary hover:bg-surface-muted"
              }`}
              style={{ borderRadius: "12px 0 0 12px" }}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setPeriod("quarter")}
              className={`h-[38px] px-4 text-sm font-medium border-y border-r transition-colors ${
                period === "quarter"
                  ? "bg-primary text-white border-primary"
                  : "bg-surface border-border text-text-secondary hover:bg-surface-muted"
              }`}
            >
              {t("quarterly")}
            </button>
            <button
              onClick={() => setPeriod("year")}
              className={`h-[38px] px-4 text-sm font-medium border transition-colors ${
                period === "year"
                  ? "bg-primary text-white border-primary"
                  : "bg-surface border-border text-text-secondary hover:bg-surface-muted"
              }`}
              style={{ borderRadius: "0 12px 12px 0" }}
            >
              {t("yearly")}
            </button>
          </div>
        </div>
      </PageHeader>

      {isLoading ? (
        <PageSkeleton variant="list" />
      ) : error ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : t("noData")}
          </p>
        </div>
      ) : !data || data.periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-16 text-center">
          <CurrencyDollarIcon className="mb-4 size-12 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">{t("noData")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("noDataHint")}
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label={t("revenue")}
              value={data.totals.revenue}
              variant="default"
            />
            <SummaryCard
              label={t("expenses")}
              value={data.totals.expenses}
              variant="destructive"
            />
            <SummaryCard
              label={t("profit")}
              value={data.totals.profit}
              variant={data.totals.profit >= 0 ? "success" : "destructive"}
            />
            <SummaryCard
              label={t("margin")}
              value={data.totals.margin}
              isPercentage
              variant={data.totals.margin >= 0 ? "success" : "destructive"}
            />
          </div>

          {/* Chart */}
          <PnlChart periods={data.periods} />

          {/* Table */}
          <PnlTable periods={data.periods} totals={data.totals} />

          {/* Projection */}
          {data.projection && <ProjectionCard projection={data.projection} />}
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  isPercentage,
  variant = "default",
}: {
  label: string
  value: number
  isPercentage?: boolean
  variant?: "default" | "success" | "destructive"
}) {
  const formatted = isPercentage
    ? `${value.toFixed(1)}%`
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(value)

  const colorClass =
    variant === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : variant === "destructive"
        ? "text-red-600 dark:text-red-400"
        : "text-text-primary"

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${colorClass}`}>
        {formatted}
      </p>
    </div>
  )
}
