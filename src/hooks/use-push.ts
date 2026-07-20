"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"

export interface PushStatusDTO {
  configured: boolean
  subscribed: boolean
  lastDeliveredAt: string | null
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(normalized)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i)
  }
  return output
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null
  }
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

/**
 * Server-side push state: whether the deployment has VAPID keys, whether this
 * account has a stored subscription, and when a digest last reached it.
 *
 * @returns The TanStack query for `GET /api/push/subscribe`.
 */
export function usePushStatus() {
  return useQuery({
    queryKey: qk.push(),
    queryFn: () => api.get<PushStatusDTO>("/api/push/subscribe"),
    staleTime: STALE_TIME.detail,
  })
}

/**
 * Asks the browser for notification permission, creates a push subscription
 * and stores it server-side.
 *
 * The whole browser flow lives here rather than in the component so the card
 * stays declarative and no raw `fetch` escapes the query layer.
 *
 * @returns A mutation invalidating the push status and toasting the outcome.
 */
export function useSubscribePush() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async () => {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key) throw new Error("Notifications non configurées sur ce serveur.")
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
        throw new Error("Ce navigateur ne supporte pas les notifications.")
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        throw new Error("Permission refusée.")
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })

      return api.post<{ ok: true }>(
        "/api/push/subscribe",
        subscription.toJSON(),
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.push() })
      toast({
        variant: "success",
        title: "Notifications activées",
        description: "Tu recevras un résumé chaque matin.",
      })
    },
    onError: (e) =>
      toast({
        variant: "error",
        title: "Erreur",
        description: e instanceof Error ? e.message : String(e),
      }),
  })
}

/**
 * Removes the browser subscription and its server-side row.
 *
 * @returns A mutation invalidating the push status and toasting the outcome.
 */
export function useUnsubscribePush() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: async () => {
      const subscription = await currentSubscription()
      if (!subscription) return { deleted: 0 }
      const { endpoint } = subscription
      await subscription.unsubscribe()
      return api.delete<{ deleted: number }>("/api/push/subscribe", {
        endpoint,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.push() })
      toast({
        variant: "success",
        title: "Notifications désactivées",
        description: "Tu ne recevras plus de résumé quotidien.",
      })
    },
    onError: (e) =>
      toast({
        variant: "error",
        title: "Erreur",
        description: e instanceof Error ? e.message : String(e),
      }),
  })
}

/**
 * Sends one test notification, the only way to tell a live subscription from
 * one the operating system dropped without telling anyone.
 *
 * @returns A mutation invalidating the push status and toasting the outcome.
 */
export function useSendTestPush() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: () =>
      api.post<{ sent: number; pruned: number }>("/api/push/test"),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk.push() })
      toast(
        result.sent > 0
          ? {
              variant: "success",
              title: "Notification envoyée",
              description: "Elle devrait arriver dans quelques secondes.",
            }
          : {
              variant: "error",
              title: "Aucun destinataire",
              description:
                "Aucun abonnement actif — réactive les notifications.",
            },
      )
    },
    onError: (e) =>
      toast({
        variant: "error",
        title: "Erreur",
        description: e instanceof Error ? e.message : String(e),
      }),
  })
}
