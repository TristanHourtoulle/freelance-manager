"use client"

import { useCallback, useState } from "react"
import { AppHeader } from "./app-header"
import { SidebarNav } from "./sidebar-nav"
import { CommandPalette } from "@/components/ui/command-palette"
import { ToastProvider } from "@/components/providers/toast-provider"

interface AppShellProps {
  userName: string
  userEmail: string
  children: React.ReactNode
}

/**
 * Root layout shell for authenticated pages.
 * Renders the sidebar, header, command palette, and toast provider.
 *
 * @param userName - Authenticated user's display name
 * @param userEmail - Authenticated user's email
 */
export function AppShell({ userName, userEmail, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleToggle = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface-secondary">
        <CommandPalette />
        <SidebarNav
          userName={userName}
          userEmail={userEmail}
          isOpen={isSidebarOpen}
          onClose={handleClose}
        />
        <div className="lg:pl-64">
          <AppHeader onMenuToggle={handleToggle} />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
