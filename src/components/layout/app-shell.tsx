"use client"

import { useCallback, useState } from "react"
import { AppHeader } from "./app-header"
import { SidebarNav } from "./sidebar-nav"
import { CommandPalette } from "@/components/ui/command-palette"
import { ToastProvider } from "@/components/providers/toast-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { UserProvider } from "@/components/providers/user-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"

import type { ThemeOption } from "@/lib/schemas/settings"

interface AppShellProps {
  userName: string
  userEmail: string
  userImage: string | null
  userTheme?: ThemeOption
  userAccentColor?: string
  children: React.ReactNode
}

export function AppShell({
  userName,
  userEmail,
  userImage,
  userTheme = "system",
  userAccentColor = "#2563eb",
  children,
}: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleToggle = useCallback(() => {
    setIsSidebarOpen((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    setIsSidebarOpen(false)
  }, [])

  return (
    <QueryProvider>
      <ToastProvider>
        <ThemeProvider
          initialTheme={userTheme}
          initialAccentColor={userAccentColor}
        >
          <UserProvider initialImage={userImage}>
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
                <main className="mx-auto max-w-7xl px-4 py-8 sm:px-5 lg:px-6">
                  {children}
                </main>
              </div>
            </div>
          </UserProvider>
        </ThemeProvider>
      </ToastProvider>
    </QueryProvider>
  )
}
