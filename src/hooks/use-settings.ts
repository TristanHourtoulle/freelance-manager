"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"

export interface SettingsDTO {
  defaultCurrency: string
  defaultPaymentDays: number
  defaultRate: number
  hasLinearToken: boolean
  linearTokenPreview: string | null
  linearLastSyncedAt: string | null
}

export function useSettings() {
  return useQuery({
    queryKey: qk.settings(),
    queryFn: () => api.get<SettingsDTO>("/api/settings"),
    staleTime: STALE_TIME.detail,
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
