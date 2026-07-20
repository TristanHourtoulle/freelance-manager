"use client"

import { useRef } from "react"
import type { CSSProperties, ReactNode } from "react"
import { Icon } from "@/components/ui/icon"
import { useDialogStack } from "@/hooks/use-dialog-stack"

interface ModalProps {
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  bodyStyle?: CSSProperties
  withGlow?: boolean
}

/**
 * Generic modal with a sticky header and an optional sticky footer. The body
 * scrolls by default; pass `bodyStyle={{ overflow: "hidden", padding: 0 }}`
 * to take over scroll management inside (used when only a sub-region must
 * scroll, e.g. the lines list of an invoice drawer).
 *
 * @param subtitle Optional secondary line under the title (12.5px muted).
 * @param withGlow Render the soft accent glow above the modal (used for the
 *                 client edit modal so the form feels lifted).
 *
 * Accessibility: locks body scroll, moves focus inside on open, traps Tab,
 * restores focus to the trigger on close, and only closes the topmost dialog
 * on Escape (shared stack with `MobileSheet`).
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width,
  bodyStyle,
  withGlow,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  useDialogStack(modalRef, onClose)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={modalRef}
        className="modal"
        style={{
          width,
          position: withGlow ? "relative" : undefined,
          overflow: withGlow ? "visible" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        {withGlow && <div className="modal-glow" aria-hidden="true" />}
        <div
          className="modal-header"
          style={{ position: "relative", zIndex: 1 }}
        >
          <div style={{ minWidth: 0 }}>
            <h3 className="modal-title">{title}</h3>
            {subtitle && (
              <div
                style={{
                  fontSize: 12.5,
                  color: "var(--text-2)",
                  marginTop: 2,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div
          className="modal-body"
          style={{
            ...(withGlow ? { position: "relative", zIndex: 1 } : null),
            ...bodyStyle,
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            className="modal-footer"
            style={withGlow ? { position: "relative", zIndex: 1 } : undefined}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
