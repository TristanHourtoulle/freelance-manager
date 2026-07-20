"use client"

import type { ReactNode } from "react"
import { useId, useRef } from "react"
import { useDialogStack } from "@/hooks/use-dialog-stack"

interface MobileSheetProps {
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  ariaLabel?: string
  children: ReactNode
}

const DEFAULT_ARIA_LABEL = "Fenêtre modale"

/**
 * Bottom-anchored sheet modal for mobile. Locks body scroll while open,
 * closes on backdrop tap or Escape, traps focus within the sheet, and
 * restores focus to the previously-focused element on unmount. When several
 * dialogs are stacked, only the topmost one reacts to Escape and owns the
 * Tab focus trap.
 *
 * @param onClose Called when the sheet requests dismissal.
 * @param title Optional heading, wired to `aria-labelledby`.
 * @param description Optional sub-heading, wired to `aria-describedby`.
 * @param ariaLabel Accessible name used when no `title` is provided.
 */
export function MobileSheet({
  onClose,
  title,
  description,
  ariaLabel,
  children,
}: MobileSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useDialogStack(sheetRef, onClose)

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : (ariaLabel ?? DEFAULT_ARIA_LABEL)}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        {title && (
          <div id={titleId} className="sheet-title">
            {title}
          </div>
        )}
        {description && (
          <div id={descriptionId} className="sheet-sub">
            {description}
          </div>
        )}
        {children}
      </div>
    </>
  )
}
