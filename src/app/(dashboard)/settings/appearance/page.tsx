"use client"

import { useCallback } from "react"
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  CheckIcon,
} from "@heroicons/react/24/outline"
import { PageHeader } from "@/components/ui/page-header"
import { useTheme } from "@/components/providers/theme-provider"
import { useToast } from "@/components/providers/toast-provider"
import { cn } from "@/lib/utils"

import type { ThemeOption } from "@/lib/schemas/settings"

const THEME_CHOICES: {
  value: ThemeOption
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}[] = [
  {
    value: "light",
    label: "Light",
    icon: SunIcon,
    description: "Always light",
  },
  { value: "dark", label: "Dark", icon: MoonIcon, description: "Always dark" },
  {
    value: "system",
    label: "System",
    icon: ComputerDesktopIcon,
    description: "Match OS",
  },
]

const ACCENT_COLORS = [
  { value: "#2563eb", label: "Blue" },
  { value: "#7c3aed", label: "Purple" },
  { value: "#059669", label: "Green" },
  { value: "#ea580c", label: "Orange" },
  { value: "#e11d48", label: "Pink" },
  { value: "#0d9488", label: "Teal" },
  { value: "#dc2626", label: "Red" },
  { value: "#4f46e5", label: "Indigo" },
]

export default function AppearanceSettingsPage() {
  const { theme, setTheme, accentColor, setAccentColor } = useTheme()
  const { toast } = useToast()

  const handleThemeChange = useCallback(
    async (value: ThemeOption) => {
      setTheme(value)
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: value }),
      })
      toast({ variant: "success", title: `Theme set to ${value}` })
    },
    [setTheme, toast],
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
      <PageHeader title="Appearance" />

      {/* Theme selector */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">Theme</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how Freelance Manager looks for you.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {THEME_CHOICES.map((t) => {
            const active = theme === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => handleThemeChange(t.value)}
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
                <t.icon className="size-6 text-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {t.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Accent color */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">
          Accent Color
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a primary color for buttons, links, and highlights.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {ACCENT_COLORS.map((c) => {
            const active = accentColor === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => handleAccentChange(c.value)}
                title={c.label}
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
