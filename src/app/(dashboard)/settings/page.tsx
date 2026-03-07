"use client"

import { useEffect, useState } from "react"
import { AvailableHoursForm } from "@/components/settings/available-hours-form"

interface Settings {
  availableHoursPerMonth: number
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  )

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

  async function handleSave(value: number) {
    setSaveStatus("idle")
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ availableHoursPerMonth: value }),
    })

    if (res.ok) {
      const json: Settings = await res.json()
      setSettings(json)
      setSaveStatus("saved")
    } else {
      setSaveStatus("error")
    }
  }

  return (
    <div className="space-y-6">
      <h1>Settings</h1>

      {isLoading ? (
        <div className="animate-pulse rounded-lg border border-border bg-surface p-6">
          <div className="h-6 w-32 rounded bg-surface-muted" />
          <div className="mt-4 h-10 w-64 rounded bg-surface-muted" />
        </div>
      ) : settings ? (
        <>
          <AvailableHoursForm
            defaultValue={settings.availableHoursPerMonth}
            onSave={handleSave}
          />
          {saveStatus === "saved" && (
            <p className="text-sm text-green-600">Settings saved.</p>
          )}
          {saveStatus === "error" && (
            <p className="text-sm text-destructive">
              Failed to save settings. Please try again.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-destructive">Failed to load settings.</p>
      )}
    </div>
  )
}
