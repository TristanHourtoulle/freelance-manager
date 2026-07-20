"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"

export interface SettingsDTO {
  defaultCurrency: string
  defaultPaymentDays: number
  defaultRate: number
  hasLinearToken: boolean
  linearTokenPreview: string | null
  linearLastSyncedAt: string | null
}

export interface SettingsUpdateBody {
  defaultPaymentDays?: number
  defaultRate?: number
}

export function useSettings() {
  return useQuery({
    queryKey: qk.settings(),
    queryFn: () => api.get<SettingsDTO>("/api/settings"),
    staleTime: STALE_TIME.detail,
  })
}

/**
 * Persists the billing defaults exposed by `PATCH /api/settings`.
 *
 * `defaultCurrency` is deliberately never sent: the app is EUR-pinned through
 * `fmtEUR`, so the currency stays read-only until multi-currency exists.
 *
 * @returns A mutation invalidating the settings query and toasting the outcome.
 */
export function useUpdateSettings() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (input: SettingsUpdateBody) =>
      api.patch<{ ok: true }>("/api/settings", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings() })
      toast({
        variant: "success",
        title: "Réglages enregistrés",
        description: "Tes valeurs par défaut sont à jour.",
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

export function useSetLinearToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) =>
      api.put("/api/settings/linear-token", { token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings() })
    },
  })
}

export function useClearLinearToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete("/api/settings/linear-token"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings() })
      qc.invalidateQueries({ queryKey: qk.projects() })
      qc.invalidateQueries({ queryKey: qk.tasks.all() })
      qc.invalidateQueries({ queryKey: qk.linear.mappings() })
    },
  })
}
