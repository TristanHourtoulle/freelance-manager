"use client"

import type { ReactNode } from "react"
import { useEffect, useId, useRef } from "react"

interface MobileSheetProps {
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Bottom-anchored sheet modal for mobile. Locks body scroll while open,
 * closes on backdrop tap or Escape, traps focus within the sheet, and
 * restores focus to the previously-focused element on unmount.
 */
export function MobileSheet({
  onClose,
  title,
  description,
  children,
}: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const sheet = sheetRef.current
    const firstFocusable = sheet?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    if (firstFocusable) {
      firstFocusable.focus()
    } else {
      sheet?.focus()
    }

    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab") return
      const sheet = sheetRef.current
      if (!sheet) return
      const focusables = Array.from(
        sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      if (focusables.length === 0) {
        event.preventDefault()
        sheet.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return
      const activeElement = document.activeElement
      if (event.shiftKey) {
        if (activeElement === first || !sheet.contains(activeElement)) {
          event.preventDefault()
          last.focus()
        }
      } else if (activeElement === last || !sheet.contains(activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        {title && (
          <div id={titleId} className="sheet-title">
            {title}
          </div>
        )}
        {description && <div className="sheet-sub">{description}</div>}
        {children}
      </div>
    </>
  )
}
