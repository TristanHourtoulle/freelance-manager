"use client"

import Link from "next/link"

import { NOTIFICATION_TYPE_CONFIG } from "@/lib/notification-colors"

import type { Notification } from "@/generated/prisma/client"

interface NotificationPanelProps {
  notifications: Notification[]
  onMarkAsRead: (id: string) => void
  onDismissAll: () => void
  onClose?: () => void
}

function formatRelativeTime(date: string | Date): string {
  const diffMs = Date.now() - new Date(date).getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return "Just now"
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return `${Math.floor(diffHours / 24)}d ago`
}

/**
 * Scrollable panel listing notifications with type-specific icons and relative timestamps.
 * Supports marking individual notifications as read and bulk dismiss.
 *
 * @param notifications - Array of notification records
 * @param onMarkAsRead - Callback to mark a single notification as read
 * @param onDismissAll - Callback to mark all notifications as read
 */
export function NotificationPanel({
  notifications,
  onMarkAsRead,
  onDismissAll,
  onClose,
}: NotificationPanelProps) {
  const hasUnread = notifications.some((n) => !n.readAt)

  return (
    <div className="w-[calc(100vw-1rem)] rounded-lg border border-border bg-surface shadow-lg sm:w-80">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Notifications
        </h3>
        {hasUnread && (
          <button
            onClick={onDismissAll}
            className="text-xs font-medium text-primary hover:text-primary/80"
          >
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-text-secondary">
          No notifications
        </div>
      ) : (
        <ul className="max-h-80 overflow-y-auto" aria-live="polite">
          {notifications.map((notification) => {
            const config = NOTIFICATION_TYPE_CONFIG[notification.type]
            const Icon = config.icon
            const isUnread = !notification.readAt

            return (
              <li key={notification.id}>
                <button
                  onClick={() => {
                    if (isUnread) onMarkAsRead(notification.id)
                  }}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-muted ${
                    isUnread ? "bg-surface-secondary/50" : ""
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {notification.title}
                      </p>
                      {isUnread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary/70">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="border-t border-border px-4 py-2.5">
        <Link
          href="/notifications"
          onClick={onClose}
          className="block text-center text-xs font-medium text-primary hover:text-primary/80"
        >
          View all notifications
        </Link>
      </div>
    </div>
  )
}
