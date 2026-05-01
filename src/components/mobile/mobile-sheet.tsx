"use client"

import type { ReactNode } from "react"
import { useEffect } from "react"

interface MobileSheetProps {
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
}

/**
 * Bottom-anchored sheet modal for mobile. Locks body scroll while open
 * and closes on backdrop tap. Title + description are optional; pass
 * raw children for fully-custom contents.
 */
export function MobileSheet({
  onClose,
  title,
  description,
  children,
}: MobileSheetProps) {
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        {title && <div className="sheet-title">{title}</div>}
        {description && <div className="sheet-sub">{description}</div>}
        {children}
      </div>
    </>
  )
}
