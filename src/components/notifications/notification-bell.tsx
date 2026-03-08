"use client"

import { useEffect, useRef, useState } from "react"
import { BellIcon } from "@heroicons/react/24/outline"
import { useNotifications } from "./use-notifications"
import { NotificationPanel } from "./notification-panel"

/**
 * Bell icon button that toggles the notification panel dropdown.
 * Displays an unread count badge when there are unread notifications.
 * Used in `AppHeader` and `SidebarNav`.
 */
export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markAsRead, dismissAll } =
    useNotifications()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscape)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex items-center justify-center rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
        aria-label="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2">
          <NotificationPanel
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onDismissAll={dismissAll}
          />
        </div>
      )}
    </div>
  )
}
