"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react"
import { useIsMobile } from "@/hooks/use-is-mobile"

export type ToastVariant = "success" | "error" | "warning" | "info"

export interface ToastData {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration: number
  createdAt: number
}

interface ToastStackProps {
  toasts: ToastData[]
  onDismiss: (id: string) => void
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

const VARIANT_ICONS: Record<ToastVariant, () => ReactElement> = {
  success: () => (
    <svg {...ICON_PROPS}>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="currentColor"
        stroke="none"
        opacity="0.18"
      />
      <polyline points="8 12.5 11 15.5 16 9.5" stroke="currentColor" />
    </svg>
  ),
  error: () => (
    <svg {...ICON_PROPS}>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="currentColor"
        stroke="none"
        opacity="0.18"
      />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  ),
  warning: () => (
    <svg {...ICON_PROPS}>
      <path
        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        fill="currentColor"
        stroke="none"
        opacity="0.18"
      />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13.5" />
      <line x1="12" y1="16.8" x2="12.01" y2="16.8" />
    </svg>
  ),
  info: () => (
    <svg {...ICON_PROPS}>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="currentColor"
        stroke="none"
        opacity="0.18"
      />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle
        cx="12"
        cy="8"
        r="0.6"
        fill="currentColor"
        stroke="currentColor"
      />
    </svg>
  ),
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

interface ToastItemProps {
  toast: ToastData
  onDismiss: (id: string) => void
  mobile: boolean
}

/**
 * One toast row. Animates in via spring, auto-dismisses after `duration`,
 * pauses on hover, and supports pointer-drag dismissal (horizontal on
 * desktop, downward on mobile).
 */
function ToastItem({ toast, onDismiss, mobile }: ToastItemProps) {
  const [phase, setPhase] = useState<"enter" | "live" | "exit">("enter")
  const [paused, setPaused] = useState(false)
  const [drag, setDrag] = useState(0)
  const draggingRef = useRef(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const startedAtRef = useRef(0)
  const remainingRef = useRef(toast.duration)

  useLayoutEffect(() => {
    startedAtRef.current = Date.now()
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => setPhase("live")),
    )
    return () => cancelAnimationFrame(r)
  }, [])

  const beginExit = useCallback(() => {
    setPhase("exit")
    setTimeout(() => onDismiss(toast.id), 280)
  }, [toast.id, onDismiss])

  useEffect(() => {
    if (toast.duration === Infinity) return
    if (paused) return
    startedAtRef.current = Date.now()
    const t = setTimeout(() => beginExit(), remainingRef.current)
    return () => {
      clearTimeout(t)
      remainingRef.current =
        remainingRef.current - (Date.now() - startedAtRef.current)
    }
  }, [paused, toast.duration, toast.id, beginExit])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const dx = e.clientX - startXRef.current
    const dy = e.clientY - startYRef.current
    if (mobile) setDrag(Math.max(dy, 0))
    else setDrag(dx)
  }
  function onPointerUp() {
    draggingRef.current = false
    if (Math.abs(drag) > 80) beginExit()
    else setDrag(0)
  }

  const Icon = VARIANT_ICONS[toast.variant]
  const cls = [
    "toast-item",
    `t-${toast.variant}`,
    `phase-${phase}`,
    mobile ? "is-mobile" : "is-desktop",
    paused ? "paused" : "",
  ]
    .filter(Boolean)
    .join(" ")
  const dragOpacity = Math.max(0, 1 - Math.abs(drag) / 220)
  const transform =
    drag !== 0
      ? `translate3d(${mobile ? 0 : drag}px, ${mobile ? Math.max(drag, 0) : 0}px, 0)`
      : undefined

  return (
    <div
      className={cls}
      style={{ transform, opacity: drag !== 0 ? dragOpacity : undefined }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="status"
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
    >
      <div className="toast-accent" />
      <div className="toast-icon">
        <Icon />
      </div>
      <div className="toast-body">
        <div className="toast-title">{toast.title}</div>
        {toast.description && (
          <div className="toast-desc">{toast.description}</div>
        )}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={(e) => {
          e.stopPropagation()
          beginExit()
        }}
        aria-label="Fermer"
      >
        <CloseIcon />
      </button>
      {toast.duration !== Infinity && (
        <div className="toast-progress">
          <div
            className="toast-progress-bar"
            style={{
              animationDuration: `${toast.duration}ms`,
              animationPlayState: paused ? "paused" : "running",
            }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Toast viewport. Top-right on desktop, bottom-fullwidth on mobile.
 * Reads viewport via `useIsMobile()` so the position stays in sync
 * with the rest of the responsive shell.
 */
export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  const mobile = useIsMobile()
  if (toasts.length === 0) return null

  const positionClass = mobile
    ? "toast-viewport pos-bottom mobile"
    : "toast-viewport pos-top-right desktop"

  return (
    <div className={positionClass} aria-label="Notifications">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} mobile={mobile} />
      ))}
    </div>
  )
}
