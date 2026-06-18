"use client"

import { useEffect, useState } from "react"

/**
 * Toggles a Command Palette via ⌘K (Mac) / Ctrl+K (others).
 * Returns `{ open, setOpen }` so callers can also open programmatically
 * (e.g. from a topbar button).
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return { open, setOpen }
}
