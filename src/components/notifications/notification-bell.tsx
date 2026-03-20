"use client"

import { useEffect, useRef, useState } from "react"
import { BellIcon } from "@heroicons/react/24/outline"
import { useNotifications } from "./use-notifications"
import { NotificationPanel } from "./notification-panel"

/**
 * Bell icon button with stadium pill-right shape matching the Figma design.
 * Displays an unread count badge when there are unread notifications.
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
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
        style={{ borderRadius: "12px 20px 20px 12px" }}
        aria-label="Notifications"
      >
        <BellIcon className="size-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-2 right-2 top-14 z-50 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 md:left-0 md:right-auto">
          <NotificationPanel
            notifications={notifications}
            onMarkAsRead={markAsRead}
            onDismissAll={dismissAll}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
