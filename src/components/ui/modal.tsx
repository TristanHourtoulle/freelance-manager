"use client"

import { useEffect } from "react"
import type { CSSProperties, ReactNode } from "react"
import { Icon } from "@/components/ui/icon"

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  bodyStyle?: CSSProperties
}

/**
 * Generic modal with a sticky header and an optional sticky footer. The body
 * scrolls by default; pass `bodyStyle={{ overflow: "hidden", padding: 0 }}`
 * to take over scroll management inside (used when only a sub-region must
 * scroll, e.g. the lines list of an invoice drawer).
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  width,
  bodyStyle,
}: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body" style={bodyStyle}>
          {children}
        </div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
