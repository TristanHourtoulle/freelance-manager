"use client"

import type { ReactNode } from "react"
import { BottomNav } from "@/components/mobile/bottom-nav"

interface MobileShellProps {
  children: ReactNode
}

/**
 * Mobile app shell: full-bleed scrollable page area with a fixed bottom
 * navigation. Pages render their own `<MobileTopbar>` inside this shell.
 */
export function MobileShell({ children }: MobileShellProps) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  )
}
