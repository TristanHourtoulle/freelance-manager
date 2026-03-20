"use client"

import { useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Cog6ToothIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { DASHBOARD_KPI_IDS, type DashboardKpiId } from "@/lib/schemas/settings"

/** Maps KPI id to its translation key under the "dashboard" namespace. */
const KPI_LABEL_KEYS: Record<DashboardKpiId, string> = {
  monthlyRevenue: "monthlyRevenue",
  pipeline: "pipeline",
  billedHours: "billedHours",
  activeClients: "activeClients",
  overdueInvoices: "overdueInvoices",
  monthlyExpenses: "monthlyExpenses",
}

interface KpiCustomizerProps {
  enabledKpis: DashboardKpiId[]
  onSave: (kpis: DashboardKpiId[]) => Promise<void>
}

export function KpiCustomizer({ enabledKpis, onSave }: KpiCustomizerProps) {
  const t = useTranslations("dashboard")
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<DashboardKpiId[]>(enabledKpis)
  const [isSaving, setIsSaving] = useState(false)

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (open) {
        setSelected(enabledKpis)
      }
    },
    [enabledKpis],
  )

  const handleToggle = useCallback(
    (kpiId: DashboardKpiId, checked: boolean) => {
      setSelected((prev) =>
        checked ? [...prev, kpiId] : prev.filter((id) => id !== kpiId),
      )
    },
    [],
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      await onSave(selected)
      setIsOpen(false)
    } finally {
      setIsSaving(false)
    }
  }, [selected, onSave])

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Cog6ToothIcon className="size-4" />
            {t("customizeKpis")}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("kpiSettings")}</DialogTitle>
          <DialogDescription>{t("kpiSettingsDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {DASHBOARD_KPI_IDS.map((kpiId) => {
            const isChecked = selected.includes(kpiId)
            return (
              <label
                key={kpiId}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleToggle(kpiId, checked === true)
                  }
                />
                <span className="text-sm font-medium">
                  {t(KPI_LABEL_KEYS[kpiId])}
                </span>
              </label>
            )
          })}
        </div>

        <DialogFooter>
          <Button
            variant="gradient"
            shape="pill"
            size="lg"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={selected.length === 0}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
