import type { ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { Topbar } from "./topbar"

interface AppShellProps {
  user: { name: string; email: string }
  crumbs: string[]
  children: ReactNode
}

/**
 * Two-column layout matching design-reference/src/app.jsx:
 * a fixed-width sidebar + main column with sticky topbar.
 */
export function AppShell({ user, crumbs, children }: AppShellProps) {
  return (
    <div className="app">
      <Sidebar user={user} />
      <div className="main">
        <Topbar crumbs={crumbs} />
        {children}
      </div>
    </div>
  )
}
