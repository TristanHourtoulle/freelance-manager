"use client"

import { useEffect, useState } from "react"

/**
 * Toggles a Command Palette via ⌘K (Mac) / Ctrl+K (others), and opens quick
 * capture via ⌘N / Ctrl+N.
 *
 * @param onQuickCapture - Opens the quick-capture dialog, when available.
 * @returns `{ open, setOpen }` so callers can also open programmatically
 * (e.g. from a topbar button).
 * @remarks The ⌘-chords are deliberately not gated on an editable target: the
 * palette focuses its own search input on open, so gating ⌘K would make it
 * impossible to close the palette with the shortcut that opened it. Only bare
 * key sequences are gated (see `useKeySequence`).
 */
export function useCommandPalette(onQuickCapture?: () => void) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "n" || e.key === "N")) {
        e.preventDefault()
        onQuickCapture?.()
        return
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onQuickCapture])

  return { open, setOpen }
}
