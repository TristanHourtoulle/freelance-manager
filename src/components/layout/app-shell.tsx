import type { ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { BottomNav } from "@/components/mobile/bottom-nav"
import { CmdKProvider } from "@/components/cmdk/cmdk-provider"
import { QuickCaptureProvider } from "@/components/capture/quick-capture-provider"
import { QuickCaptureFab } from "@/components/mobile/quick-capture-fab"

interface AppShellProps {
  user: { id: string; name: string; email: string }
  children: ReactNode
}

/**
 * Responsive shell. Desktop: fixed sidebar + sticky topbar (mirrors
 * design-reference/src/app.jsx). Mobile: full-bleed scroll area with
 * a fixed bottom nav. Visibility is CSS-driven (.desktop-only / .mobile-only)
 * so server and client agree on the markup and there's no hydration
 * mismatch when the viewport is narrow.
 */
export function AppShell({ user, children }: AppShellProps) {
  return (
    <QuickCaptureProvider>
      <CmdKProvider>
        <div className="app">
          <div className="desktop-only">
            <Sidebar user={user} />
          </div>
          <div className="main">
            <div className="desktop-only">
              <Topbar />
            </div>
            {children}
          </div>
          <div className="mobile-only">
            <QuickCaptureFab />
            <BottomNav />
          </div>
        </div>
      </CmdKProvider>
    </QuickCaptureProvider>
  )
}
