"use client"

import { useEffect, useState } from "react"
import { AvailableHoursForm } from "@/components/settings/available-hours-form"
import { RevenueTargetForm } from "@/components/settings/revenue-target-form"
import { PageHeader } from "@/components/ui/page-header"
import { TooltipHint } from "@/components/ui/tooltip-hint"
import { useToast } from "@/components/providers/toast-provider"

interface Settings {
  availableHoursPerMonth: number
  monthlyRevenueTarget: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    async function load() {
      setIsLoading(true)
      const res = await fetch("/api/settings", { cache: "no-store" })
      if (res.ok) {
        const json: Settings = await res.json()
        setSettings(json)
      }
      setIsLoading(false)
    }

    load()
  }, [])

  async function handleSaveHours(value: number) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availableHoursPerMonth: value }),
    })

    if (res.ok) {
      const json: Settings = await res.json()
      setSettings(json)
      toast({ variant: "success", title: "Settings saved" })
    } else {
      toast({ variant: "error", title: "Failed to save settings" })
    }
  }

  async function handleSaveTarget(value: number) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyRevenueTarget: value }),
    })

    if (res.ok) {
      const json: Settings = await res.json()
      setSettings(json)
      toast({ variant: "success", title: "Settings saved" })
    } else {
      toast({ variant: "error", title: "Failed to save settings" })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <TooltipHint storageKey="settings-page">
        Configure your working hours and revenue target for dashboard analytics.
      </TooltipHint>

      {isLoading ? (
        <div className="animate-pulse rounded-lg border border-border bg-surface p-6">
          <div className="h-6 w-32 rounded bg-surface-muted" />
          <div className="mt-4 h-10 w-64 rounded bg-surface-muted" />
        </div>
      ) : settings ? (
        <>
          <AvailableHoursForm
            defaultValue={settings.availableHoursPerMonth}
            onSave={handleSaveHours}
          />
          <RevenueTargetForm
            defaultValue={settings.monthlyRevenueTarget}
            onSave={handleSaveTarget}
          />
        </>
      ) : (
        <p className="text-sm text-destructive">Failed to load settings.</p>
      )}
    </div>
  )
}
