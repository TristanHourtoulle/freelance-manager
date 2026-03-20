"use client"

import { useQuery } from "@tanstack/react-query"

interface UserProfile {
  name: string
  email: string
}

interface Settings {
  dashboardKpis: string[]
  [key: string]: unknown
}

interface TokenStatus {
  configured: boolean
  maskedToken: string | null
}

interface WebhookStatus {
  configured: boolean
  webhookUrl: string | null
}

interface SyncStatus {
  lastSyncedAt: number | null
  isStale: boolean
}

/**
 * Fetches the current user profile. Cached for 5 minutes.
 */
export function useUserProfile() {
  return useQuery<UserProfile>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user")
      if (!res.ok) throw new Error("Failed to fetch user profile")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetches user settings (dashboard KPIs, etc.). Cached for 5 minutes.
 */
export function useSettings() {
  return useQuery<Settings>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings")
      if (!res.ok) throw new Error("Failed to fetch settings")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetches Linear API token configuration status. Cached for 5 minutes.
 */
export function useLinearTokenStatus() {
  return useQuery<TokenStatus>({
    queryKey: ["linear-token-status"],
    queryFn: async () => {
      const res = await fetch("/api/settings/linear-token")
      if (!res.ok) throw new Error("Failed to fetch token status")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetches webhook configuration status. Cached for 5 minutes.
 */
export function useWebhookStatus() {
  return useQuery<WebhookStatus>({
    queryKey: ["webhook-status"],
    queryFn: async () => {
      const res = await fetch("/api/settings/webhook-status")
      if (!res.ok) throw new Error("Failed to fetch webhook status")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Fetches Linear cache/sync status. Cached for 1 minute.
 */
export function useLinearCacheStatus() {
  return useQuery<SyncStatus>({
    queryKey: ["linear-cache-status"],
    queryFn: async () => {
      const res = await fetch("/api/linear/cache-status")
      if (!res.ok) throw new Error("Failed to fetch cache status")
      return res.json()
    },
    staleTime: 1 * 60 * 1000,
  })
}
