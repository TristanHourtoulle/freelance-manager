"use client"

import { useCallback } from "react"
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  CheckIcon,
} from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"
import { PageHeader } from "@/components/ui/page-header"
import { useTheme } from "@/components/providers/theme-provider"
import { useToast } from "@/components/providers/toast-provider"
import { cn } from "@/lib/utils"

import type { ThemeOption } from "@/lib/schemas/settings"

const THEME_CHOICES: {
  value: ThemeOption
  labelKey: "light" | "dark" | "system"
  icon: React.ComponentType<{ className?: string }>
  descKey: "lightDesc" | "darkDesc" | "systemDesc"
}[] = [
  {
    value: "light",
    labelKey: "light",
    icon: SunIcon,
    descKey: "lightDesc",
  },
  { value: "dark", labelKey: "dark", icon: MoonIcon, descKey: "darkDesc" },
  {
    value: "system",
    labelKey: "system",
    icon: ComputerDesktopIcon,
    descKey: "systemDesc",
  },
]

const ACCENT_COLORS: {
  value: string
  labelKey:
    | "blue"
    | "purple"
    | "green"
    | "orange"
    | "pink"
    | "teal"
    | "red"
    | "indigo"
}[] = [
  { value: "#2563eb", labelKey: "blue" },
  { value: "#7c3aed", labelKey: "purple" },
  { value: "#059669", labelKey: "green" },
  { value: "#ea580c", labelKey: "orange" },
  { value: "#e11d48", labelKey: "pink" },
  { value: "#0d9488", labelKey: "teal" },
  { value: "#dc2626", labelKey: "red" },
  { value: "#4f46e5", labelKey: "indigo" },
]

export default function AppearanceSettingsPage() {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme()
  const { toast } = useToast()
  const t = useTranslations("settingsAppearance")

  const handleThemeChange = useCallback(
    async (value: ThemeOption) => {
      setTheme(value)
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: value }),
      })
      toast({
        variant: "success",
        title: t("toasts.themeSet", { theme: value }),
      })
    },
    [setTheme, toast, t],
  )

  const handleAccentChange = useCallback(
    async (color: string) => {
      setAccentColor(color)
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accentColor: color }),
      })
    },
    [setAccentColor],
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      {/* Theme selector */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">
          {t("themeTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("themeDesc")}</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {THEME_CHOICES.map((tc) => {
            const active = theme === tc.value
            return (
              <button
                key={tc.value}
                type="button"
                onClick={() => handleThemeChange(tc.value)}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                {active && (
                  <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-white">
                    <CheckIcon className="size-3" />
                  </div>
                )}
                <tc.icon className="size-6 text-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {t(tc.labelKey)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(tc.descKey)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Accent color */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">
          {t("accentTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("accentDesc")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {ACCENT_COLORS.map((c) => {
            const active = accentColor === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => handleAccentChange(c.value)}
                title={t(`colors.${c.labelKey}`)}
                className={cn(
                  "relative flex size-10 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110",
                  active && "ring-2 ring-offset-2 ring-offset-surface",
                )}
                style={{
                  backgroundColor: c.value,
                  ...(active ? { ringColor: c.value } : {}),
                }}
              >
                {active && <CheckIcon className="size-4 text-white" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
