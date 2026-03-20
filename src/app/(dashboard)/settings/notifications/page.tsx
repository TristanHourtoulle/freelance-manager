"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/providers/toast-provider"

import type { NotificationPrefs } from "@/lib/schemas/settings"
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/schemas/settings"

interface ToggleCardProps {
  title: string
  description: string
  enabled: boolean
  onToggle: (enabled: boolean) => void
  threshold?: {
    label: string
    value: number
    onChange: (value: number) => void
    min: number
    max: number
    suffix: string
  }
}

function ToggleCard({
  title,
  description,
  enabled,
  onToggle,
  threshold,
}: ToggleCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            enabled ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {enabled && threshold && (
        <div className="mt-3 flex items-center gap-2.5">
          <label className="text-xs text-muted-foreground">
            {threshold.label}
          </label>
          <Input
            type="number"
            min={threshold.min}
            max={threshold.max}
            value={threshold.value}
            onChange={(e) =>
              threshold.onChange(Number(e.target.value) || threshold.min)
            }
            className="h-[34px] w-20 px-4 text-xs"
            style={{ borderRadius: "9999px" }}
          />
          <span className="text-xs text-muted-foreground">
            {threshold.suffix}
          </span>
        </div>
      )}
    </div>
  )
}

export default function NotificationsSettingsPage() {
  const { toast } = useToast()
  const t = useTranslations("settingsNotifications")
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch("/api/settings", { cache: "no-store" })
      if (!cancelled && res.ok) {
        const data = await res.json()
        setPrefs(data.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS)
      }
      if (!cancelled) setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(
    async (updated: NotificationPrefs) => {
      setPrefs(updated)
      setIsSaving(true)
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationPrefs: updated }),
      })
      setIsSaving(false)
      if (res.ok) {
        toast({ variant: "success", title: t("toasts.success") })
      } else {
        toast({ variant: "error", title: t("toasts.error") })
      }
    },
    [toast, t],
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        {isSaving && (
          <span className="text-xs text-muted-foreground">{t("saving")}</span>
        )}
      </PageHeader>

      <ToggleCard
        title={t("billingReminders")}
        description={t("billingRemindersDesc")}
        enabled={prefs.billingReminder.enabled}
        onToggle={(enabled) =>
          save({
            ...prefs,
            billingReminder: { ...prefs.billingReminder, enabled },
          })
        }
        threshold={{
          label: t("remindAfter"),
          value: prefs.billingReminder.delayDays,
          onChange: (delayDays) =>
            save({
              ...prefs,
              billingReminder: { ...prefs.billingReminder, delayDays },
            }),
          min: 1,
          max: 90,
          suffix: t("days"),
        }}
      />

      <ToggleCard
        title={t("inactiveClient")}
        description={t("inactiveClientDesc")}
        enabled={prefs.inactiveClient.enabled}
        onToggle={(enabled) =>
          save({
            ...prefs,
            inactiveClient: { ...prefs.inactiveClient, enabled },
          })
        }
        threshold={{
          label: t("after"),
          value: prefs.inactiveClient.delayDays,
          onChange: (delayDays) =>
            save({
              ...prefs,
              inactiveClient: { ...prefs.inactiveClient, delayDays },
            }),
          min: 7,
          max: 365,
          suffix: t("daysOfInactivity"),
        }}
      />

      <ToggleCard
        title={t("syncAlerts")}
        description={t("syncAlertsDesc")}
        enabled={prefs.syncAlert.enabled}
        onToggle={(enabled) => save({ ...prefs, syncAlert: { enabled } })}
      />

      <ToggleCard
        title={t("paymentOverdue")}
        description={t("paymentOverdueDesc")}
        enabled={prefs.paymentOverdue.enabled}
        onToggle={(enabled) => save({ ...prefs, paymentOverdue: { enabled } })}
      />
    </div>
  )
}
