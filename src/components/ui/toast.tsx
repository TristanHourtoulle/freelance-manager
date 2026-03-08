"use client"

import { useEffect, useState } from "react"
import { XMarkIcon } from "@heroicons/react/20/solid"
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline"

type ToastVariant = "success" | "error" | "warning" | "info"

interface ToastData {
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

const VARIANT_STYLES: Record<
  ToastVariant,
  { container: string; icon: string; progress: string }
> = {
  success: {
    container: "border-green-200 bg-green-50 text-green-800",
    icon: "text-green-500",
    progress: "bg-green-400",
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-800",
    icon: "text-red-500",
    progress: "bg-red-400",
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-800",
    icon: "text-amber-500",
    progress: "bg-amber-400",
  },
  info: {
    container: "border-blue-200 bg-blue-50 text-blue-800",
    icon: "text-blue-500",
    progress: "bg-blue-400",
  },
}

const VARIANT_ICONS: Record<
  ToastVariant,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  warning: ExclamationTriangleIcon,
  info: InformationCircleIcon,
}

interface ToastItemProps {
  toast: ToastData
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const enterFrame = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(enterFrame)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true)
      setTimeout(() => onDismiss(toast.id), 200)
    }, toast.duration)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  function handleDismiss() {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 200)
  }

  const styles = VARIANT_STYLES[toast.variant]
  const Icon = VARIANT_ICONS[toast.variant]

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`pointer-events-auto relative w-80 overflow-hidden rounded-lg border shadow-lg transition-all duration-200 ${styles.container} ${
        isVisible && !isExiting
          ? "translate-x-0 opacity-100"
          : "translate-x-4 opacity-0"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className={`h-5 w-5 shrink-0 ${styles.icon}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-sm opacity-80">{toast.description}</p>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 w-full bg-black/5">
        <div
          className={`h-full ${styles.progress}`}
          style={{
            animation: `toast-progress ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  )
}

/**
 * Fixed-position container that renders a stack of toast notifications.
 * Toasts auto-dismiss after their configured duration and animate in/out.
 * Rendered in the root layout to provide app-wide feedback.
 *
 * @param toasts - Array of active toast data objects to display
 * @param onDismiss - Callback to remove a toast by id
 */
export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  )
}
