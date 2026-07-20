"use client"

import { useEffect, useRef, useState } from "react"

const SEQUENCE_TIMEOUT_MS = 1200

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  )
}

/**
 * Toggles a Command Palette via ⌘K (Mac) / Ctrl+K (others).
 * While the palette is closed the shortcut is ignored on editable targets so
 * it never steals a keystroke from a form field; while it is open the shortcut
 * always closes it, since focus then lives in the palette's own search input.
 *
 * @returns `{ open, setOpen }` so callers can also open programmatically
 * (e.g. from a topbar button).
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || (e.key !== "k" && e.key !== "K")) return
      if (!openRef.current && isEditableTarget(e.target)) return
      e.preventDefault()
      setOpen((o) => !o)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return { open, setOpen }
}

/**
 * Fires `onMatch` when the user types `keys` in order without an intervening
 * key, e.g. `["g", "d"]`. Ignores events targeting inputs, textareas, selects
 * and contentEditable hosts, events carrying a modifier, and every event while
 * `disabled` is true. The pending prefix resets after `SEQUENCE_TIMEOUT_MS`.
 *
 * @param keys - Lowercase key sequence to match.
 * @param onMatch - Called once when the full sequence completes.
 * @param disabled - When true the sequence never fires.
 */
export function useKeySequence(
  keys: readonly string[],
  onMatch: () => void,
  disabled: boolean,
): void {
  const onMatchRef = useRef(onMatch)
  const disabledRef = useRef(disabled)
  const keysRef = useRef(keys)

  useEffect(() => {
    onMatchRef.current = onMatch
    disabledRef.current = disabled
    keysRef.current = keys
  })

  useEffect(() => {
    let index = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    function reset() {
      index = 0
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    function onKey(e: KeyboardEvent) {
      if (
        disabledRef.current ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isEditableTarget(e.target)
      ) {
        reset()
        return
      }

      const sequence = keysRef.current
      if (sequence.length === 0) return
      const key = e.key.toLowerCase()

      if (key !== sequence[index]) {
        reset()
        if (key !== sequence[0]) return
      }

      index += 1
      if (timer !== null) clearTimeout(timer)

      if (index >= sequence.length) {
        reset()
        onMatchRef.current()
        return
      }

      timer = setTimeout(reset, SEQUENCE_TIMEOUT_MS)
    }

    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      if (timer !== null) clearTimeout(timer)
    }
  }, [])
}
