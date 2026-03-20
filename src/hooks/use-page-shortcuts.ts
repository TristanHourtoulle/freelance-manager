"use client"

import { useEffect } from "react"

interface PageShortcuts {
  /** Triggered when 'N' is pressed (new item) */
  onNew?: () => void
}

/**
 * Registers page-level keyboard shortcuts.
 * Shortcuts are ignored when the user is typing in an input, textarea, or contenteditable.
 */
export function usePageShortcuts({ onNew }: PageShortcuts) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable

      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === "n" && onNew) {
        e.preventDefault()
        onNew()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onNew])
}
