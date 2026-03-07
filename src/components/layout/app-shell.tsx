"use client"

import { useCallback, useState } from "react"
import { AppHeader } from "./app-header"
import { SidebarNav } from "./sidebar-nav"

interface AppShellProps {
  userName: string
  userEmail: string
  children: React.ReactNode
}

export function AppShell({ userName, userEmail, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleToggle = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
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
  )
}
