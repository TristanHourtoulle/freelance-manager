"use client"

import { useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import type { Notification } from "@/generated/prisma/client"

interface NotificationsResponse {
  items: Notification[]
  unreadCount: number
}

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  markAsRead: (id: string) => void
  dismissAll: () => void
  refetch: () => void
}

/**
 * Fetches and manages user notifications with React Query caching.
 * Shared across NotificationBell and NotificationsPage via query key deduplication.
 */
export function useNotifications(): UseNotificationsReturn {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await fetch(
        "/api/notifications?unreadOnly=false&limit=20",
      )
      if (!response.ok) throw new Error("Failed to fetch notifications")
      return response.json()
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  })

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
      })
      if (!response.ok) throw new Error("Failed to mark as read")
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] })
      const previous = queryClient.getQueryData<NotificationsResponse>([
        "notifications",
      ])

      if (previous) {
        queryClient.setQueryData<NotificationsResponse>(["notifications"], {
          items: previous.items.map((n) =>
            n.id === id ? { ...n, readAt: new Date() } : n,
          ),
          unreadCount: Math.max(0, previous.unreadCount - 1),
        })
      }
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous)
      }
    },
  })

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/dismiss-all", {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to dismiss all")
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] })
      const previous = queryClient.getQueryData<NotificationsResponse>([
        "notifications",
      ])

      if (previous) {
        queryClient.setQueryData<NotificationsResponse>(["notifications"], {
          items: previous.items.map((n) =>
            n.readAt ? n : { ...n, readAt: new Date() },
          ),
          unreadCount: 0,
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous)
      }
    },
  })

  const markAsRead = useCallback(
    (id: string) => markAsReadMutation.mutate(id),
    [markAsReadMutation],
  )

  const dismissAll = useCallback(
    () => dismissAllMutation.mutate(),
    [dismissAllMutation],
  )

  const refetch = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    [queryClient],
  )

  return {
    notifications: data?.items ?? [],
    unreadCount: data?.unreadCount ?? 0,
    isLoading,
    markAsRead,
    dismissAll,
    refetch,
  }
}
