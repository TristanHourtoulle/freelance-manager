"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import type { ThemeOption } from "@/lib/schemas/settings"

interface ThemeContextValue {
  theme: ThemeOption
  setTheme: (theme: ThemeOption) => void
  accentColor: string
  setAccentColor: (color: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyThemeClass(theme: ThemeOption) {
  const root = document.documentElement
  if (theme === "dark") {
    root.classList.add("dark")
  } else if (theme === "light") {
    root.classList.remove("dark")
  } else {
    // system
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches
    root.classList.toggle("dark", prefersDark)
  }
}

function applyAccentColor(color: string) {
  const root = document.documentElement
  root.style.setProperty("--color-primary", color)
  // Also update shadcn --primary so Tailwind `bg-primary` / `dark:from-primary` works
  root.style.setProperty("--primary", color)
}

interface ThemeProviderProps {
  initialTheme: ThemeOption
  initialAccentColor: string
  children: React.ReactNode
}

function getStoredTheme(fallback: ThemeOption): ThemeOption {
  if (typeof window === "undefined") return fallback
  const stored = localStorage.getItem("fm:theme")
  if (stored === "light" || stored === "dark" || stored === "system")
    return stored
  return fallback
}

function getStoredAccentColor(fallback: string): string {
  if (typeof window === "undefined") return fallback
  return localStorage.getItem("fm:accentColor") ?? fallback
}

export function ThemeProvider({
  initialTheme,
  initialAccentColor,
  children,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeOption>(() =>
    getStoredTheme(initialTheme),
  )
  const [accentColor, setAccentColorState] = useState(() =>
    getStoredAccentColor(initialAccentColor),
  )

  // Apply theme on mount and changes
  useEffect(() => {
    applyThemeClass(theme)
  }, [theme])

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (theme !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyThemeClass("system")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  // Apply accent color
  useEffect(() => {
    applyAccentColor(accentColor)
  }, [accentColor])

  const setTheme = useCallback((t: ThemeOption) => {
    setThemeState(t)
    localStorage.setItem("fm:theme", t)
  }, [])

  const setAccentColor = useCallback((c: string) => {
    setAccentColorState(c)
    localStorage.setItem("fm:accentColor", c)
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, accentColor, setAccentColor }),
    [theme, setTheme, accentColor, setAccentColor],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
