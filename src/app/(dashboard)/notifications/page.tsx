"use client"

import { useState, useMemo } from "react"
import {
  ArrowDownTrayIcon,
  CurrencyEuroIcon,
  ExclamationTriangleIcon,
  UserIcon,
  CheckIcon,
} from "@heroicons/react/24/outline"
import { useNotifications } from "@/components/notifications/use-notifications"
import { Button } from "@/components/ui/button"

import type { Notification, NotificationType } from "@/generated/prisma/client"

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  BILLING_REMINDER: {
    icon: CurrencyEuroIcon,
    color: "text-amber-500 bg-amber-50",
  },
  INACTIVE_CLIENT: { icon: UserIcon, color: "text-blue-500 bg-blue-50" },
  SYNC_ALERT: {
    icon: ExclamationTriangleIcon,
    color: "text-red-500 bg-red-50",
  },
  IMPORT_SUMMARY: {
    icon: ArrowDownTrayIcon,
    color: "text-emerald-500 bg-emerald-50",
  },
}

type FilterTab = "all" | "unread"

function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

function NotificationRow({
  notification,
  onMarkAsRead,
}: {
  notification: Notification
  onMarkAsRead: (id: string) => void
}) {
  const config = TYPE_CONFIG[notification.type]
  const Icon = config.icon
  const isUnread = !notification.readAt

  return (
    <div
      className={`flex items-start gap-4 rounded-lg border border-border px-4 py-3 transition-colors ${
        isUnread ? "bg-surface-secondary/50" : "bg-surface"
      }`}
    >
      <div
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.color}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text-primary">
            {notification.title}
          </p>
          {isUnread && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="mt-0.5 text-sm text-text-secondary">
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-text-secondary/70">
          {formatDate(notification.createdAt)}
        </p>
      </div>
      {isUnread && (
        <button
          onClick={() => onMarkAsRead(notification.id)}
          className="shrink-0 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
          title="Mark as read"
        >
          <CheckIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, markAsRead, dismissAll } =
    useNotifications()
  const [filter, setFilter] = useState<FilterTab>("all")

  const filtered = useMemo(() => {
    if (filter === "unread") {
      return notifications.filter((n) => !n.readAt)
    }
    return notifications
  }, [notifications, filter])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1>Notifications</h1>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={dismissAll}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-primary text-white"
              : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            filter === "unread"
              ? "bg-primary text-white"
              : "bg-surface-secondary text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
          }`}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-text-secondary">
          Loading notifications...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface py-16 text-center">
          <p className="text-sm text-text-secondary">
            {filter === "unread"
              ? "No unread notifications"
              : "No notifications yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
            />
          ))}
        </div>
      )}
    </div>
  )
}
