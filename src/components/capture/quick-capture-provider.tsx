"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Modal } from "@/components/ui/modal"
import { MobileSheet } from "@/components/mobile/mobile-sheet"
import { QuickCaptureForm } from "@/components/capture/quick-capture-form"
import { useIsMobile } from "@/hooks/use-is-mobile"

interface QuickCaptureContextValue {
  open: () => void
  close: () => void
}

const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(null)

/**
 * Mounts the two-tap capture dialog once at the app root and exposes
 * `useQuickCapture()` so the FAB, the command palette and ⌘N can open it.
 */
export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  const value = useMemo<QuickCaptureContextValue>(
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }),
    [],
  )

  return (
    <QuickCaptureContext value={value}>
      {children}
      {open &&
        (isMobile ? (
          <MobileSheet title="Nouvelle action" onClose={value.close}>
            <div className="sheet-fields">
              <QuickCaptureForm onDone={value.close} />
            </div>
          </MobileSheet>
        ) : (
          <Modal title="Nouvelle action" onClose={value.close}>
            <QuickCaptureForm onDone={value.close} />
          </Modal>
        ))}
    </QuickCaptureContext>
  )
}

/**
 * Returns the quick-capture controls.
 *
 * @returns The open/close helpers.
 * @throws When called outside a {@link QuickCaptureProvider}.
 */
export function useQuickCapture(): QuickCaptureContextValue {
  const ctx = useContext(QuickCaptureContext)
  if (!ctx) {
    throw new Error(
      "useQuickCapture must be used within a QuickCaptureProvider",
    )
  }
  return ctx
}

/**
 * Returns the quick-capture controls, or `null` when no provider is mounted.
 *
 * @returns The open/close helpers, or `null` outside a
 * {@link QuickCaptureProvider}.
 */
export function useOptionalQuickCapture(): QuickCaptureContextValue | null {
  return useContext(QuickCaptureContext)
}
