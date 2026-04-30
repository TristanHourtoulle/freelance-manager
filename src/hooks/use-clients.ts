"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { ClientCreateInput } from "@/lib/schemas/client"

export interface ClientDTO {
  id: string
  firstName: string
  lastName: string
  company: string | null
  email: string | null
  phone: string | null
  billingMode: "DAILY" | "FIXED" | "HOURLY"
  rate: number
  fixedPrice: number | null
  deposit: number | null
  paymentTerms: number | null
  category: "FREELANCE" | "STUDY" | "PERSONAL" | "SIDE_PROJECT"
  color: string | null
  archived: boolean
  createdAt: string
}

const CLIENTS_KEY = ["clients"] as const

export function useClients() {
  return useQuery({
    queryKey: CLIENTS_KEY,
    queryFn: () => api.get<{ items: ClientDTO[] }>("/api/clients"),
    select: (d) => d.items,
    staleTime: 30_000,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClientCreateInput) =>
      api.post<ClientDTO>("/api/clients", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
    },
  })
}

export function useArchiveClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/clients/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLIENTS_KEY })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
    },
  })
}
