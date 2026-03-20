"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"

interface Projection {
  nextPeriod: string
  estimatedRevenue: number
  estimatedExpenses: number
  estimatedProfit: number
}

interface ProjectionCardProps {
  projection: Projection
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

export function ProjectionCard({ projection }: ProjectionCardProps) {
  const t = useTranslations("financial")

  return (
    <Card className="py-0 border-dashed">
      <CardContent className="p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t("projection")} — {projection.nextPeriod}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {t("projectionHint")}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("estimatedRevenue")}
            </p>
            <p className="text-lg font-bold tabular-nums text-text-primary">
              {formatCurrency(projection.estimatedRevenue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("estimatedExpenses")}
            </p>
            <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(projection.estimatedExpenses)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("estimatedProfit")}
            </p>
            <p
              className={`text-lg font-bold tabular-nums ${
                projection.estimatedProfit >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(projection.estimatedProfit)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
