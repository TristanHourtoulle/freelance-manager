"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"

export interface SettingsDTO {
  defaultCurrency: string
  defaultPaymentDays: number
  defaultRate: number
  hasLinearToken: boolean
  linearTokenPreview: string | null
  linearLastSyncedAt: string | null
}

const SETTINGS_KEY = ["settings"] as const

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => api.get<SettingsDTO>("/api/settings"),
    staleTime: 60_000,
  })
}

export function useSetLinearToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) =>
      api.put("/api/settings/linear-token", { token }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETTINGS_KEY })
    },
  })
}

export function useClearLinearToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete("/api/settings/linear-token"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETTINGS_KEY })
      qc.invalidateQueries({ queryKey: ["projects"] })
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["linear-mappings"] })
    },
  })
}
