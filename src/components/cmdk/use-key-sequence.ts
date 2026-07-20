"use client"

import { useEffect } from "react"

const DEFAULT_TIMEOUT_MS = 1200

/**
 * Report whether an event target is a text-entry surface.
 *
 * @param target - Event target to inspect, typically `event.target`.
 * @returns `true` for inputs, textareas, selects and contenteditable nodes.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return true
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLElement && target.isContentEditable) return true
  return false
}

/**
 * Bind chorded key sequences such as `G` then `D`.
 *
 * Bare-key sequences never fire while focus sits in a text field, a textarea,
 * a select, or a contenteditable element.
 *
 * @param bindings - Map of space-free sequences (`"gd"`) to their handler.
 * @param timeoutMs - Milliseconds allowed between two keys of a sequence.
 */
export function useKeySequence(
  bindings: Record<string, () => void>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): void {
  useEffect(() => {
    let buffer = ""
    let timer: ReturnType<typeof setTimeout> | null = null

    function reset() {
      buffer = ""
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        reset()
        return
      }
      if (isEditableTarget(e.target)) {
        reset()
        return
      }
      if (e.key.length !== 1) {
        reset()
        return
      }

      const next = buffer + e.key.toLowerCase()
      const handler = bindings[next]
      if (handler) {
        e.preventDefault()
        reset()
        handler()
        return
      }

      const isPrefix = Object.keys(bindings).some((k) => k.startsWith(next))
      if (!isPrefix) {
        reset()
        return
      }

      buffer = next
      if (timer) clearTimeout(timer)
      timer = setTimeout(reset, timeoutMs)
    }

    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
      if (timer) clearTimeout(timer)
    }
  }, [bindings, timeoutMs])
}
