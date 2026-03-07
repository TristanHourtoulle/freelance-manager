"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { ToastStack } from "@/components/ui/toast"

type ToastVariant = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  duration: number
  createdAt: number
}

interface ToastOptions {
  variant: ToastVariant
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const MAX_TOASTS = 3
const DEFAULT_DURATION = 5000

let toastCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((options: ToastOptions) => {
    const id = String(++toastCounter)
    const newToast: Toast = {
      id,
      variant: options.variant,
      title: options.title,
      description: options.description,
      duration: options.duration ?? DEFAULT_DURATION,
      createdAt: Date.now(),
    }

    setToasts((prev) => {
      const next = [...prev, newToast]
      if (next.length > MAX_TOASTS) {
        return next.slice(next.length - MAX_TOASTS)
      }
      return next
    })
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext value={{ toast }}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}
