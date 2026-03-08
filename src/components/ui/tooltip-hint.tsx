"use client"

import { useState } from "react"
import { XMarkIcon } from "@heroicons/react/24/outline"

interface TooltipHintProps {
  storageKey: string
  children: React.ReactNode
}

const STORAGE_PREFIX = "fm:tooltip-dismissed:"

function getStorageValue(key: string): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(`${STORAGE_PREFIX}${key}`) === "1"
}

/**
 * Dismissible hint banner persisted via localStorage.
 * Once dismissed, it never reappears for the same storageKey.
 * Used to display one-time onboarding or contextual tips.
 *
 * @param storageKey - Unique key used to track dismissal state in localStorage
 */
export function TooltipHint({ storageKey, children }: TooltipHintProps) {
  const [isDismissed, setIsDismissed] = useState(() =>
    getStorageValue(storageKey),
  )

  if (isDismissed) return null

  function handleDismiss() {
    localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, "1")
    setIsDismissed(true)
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary-light px-4 py-3">
      <p className="min-w-0 flex-1 text-sm text-text-secondary">{children}</p>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 text-text-muted hover:text-text-secondary transition-colors"
        aria-label="Dismiss hint"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  )
}
