import type { ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"
import { BottomNav } from "@/components/mobile/bottom-nav"
import { CmdKProvider } from "@/components/cmdk/cmdk-provider"

interface AppShellProps {
  user: { name: string; email: string }
  crumbs: string[]
  children: ReactNode
}

/**
 * Responsive shell. Desktop: fixed sidebar + sticky topbar (mirrors
 * design-reference/src/app.jsx). Mobile: full-bleed scroll area with
 * a fixed bottom nav. Visibility is CSS-driven (.desktop-only / .mobile-only)
 * so server and client agree on the markup and there's no hydration
 * mismatch when the viewport is narrow.
 */
export function AppShell({ user, crumbs, children }: AppShellProps) {
  return (
    <CmdKProvider>
      <div className="app">
        <div className="desktop-only">
          <Sidebar user={user} />
        </div>
        <div className="main">
          <div className="desktop-only">
            <Topbar crumbs={crumbs} />
          </div>
          {children}
        </div>
        <div className="mobile-only">
          <BottomNav />
        </div>
      </div>
    </CmdKProvider>
  )
}
