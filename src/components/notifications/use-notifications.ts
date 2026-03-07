"use client"

import { useCallback, useEffect, useState } from "react"

import type { Notification } from "@/generated/prisma/client"

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  markAsRead: (id: string) => Promise<void>
  dismissAll: () => Promise<void>
  refetch: () => Promise<void>
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/notifications?unreadOnly=false&limit=20",
      )
      if (!response.ok) return

      const data = await response.json()
      setNotifications(data.items)
      setUnreadCount(data.unreadCount)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        fetchNotifications()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [fetchNotifications])

  const markAsRead = useCallback(async (id: string) => {
    const response = await fetch(`/api/notifications/${id}/read`, {
      method: "PATCH",
    })
    if (!response.ok) return

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)),
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const dismissAll = useCallback(async () => {
    const response = await fetch("/api/notifications/dismiss-all", {
      method: "POST",
    })
    if (!response.ok) return

    setNotifications((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date() })),
    )
    setUnreadCount(0)
  }, [])

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    dismissAll,
    refetch: fetchNotifications,
  }
}
