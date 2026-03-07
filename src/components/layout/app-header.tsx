"use client"

import { Bars3Icon } from "@heroicons/react/24/outline"
import { NotificationBell } from "@/components/notifications/notification-bell"

interface AppHeaderProps {
  onMenuToggle: () => void
}

export function AppHeader({ onMenuToggle }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-muted"
      >
        <Bars3Icon className="h-5 w-5" />
      </button>
      <span className="flex-1 text-sm font-semibold text-text-primary">
        FreelanceDash
      </span>
      <NotificationBell />
    </header>
  )
}
