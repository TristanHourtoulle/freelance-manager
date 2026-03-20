"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import type { SerializedClient, Pagination } from "@/components/clients/types"

interface ClientsResponse {
  items: SerializedClient[]
  pagination: Pagination
}

/**
 * Fetches clients list with filters. Cached for 2 minutes.
 */
export function useClients(searchParams: string) {
  return useQuery<ClientsResponse>({
    queryKey: ["clients", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/clients?${searchParams}`)
      if (!res.ok) throw new Error("Failed to fetch clients")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Archives or unarchives a client.
 */
export function useArchiveClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      clientId,
      archive,
    }: {
      clientId: string
      archive: boolean
    }) => {
      const endpoint = archive ? "archive" : "unarchive"
      const res = await fetch(`/api/clients/${clientId}/${endpoint}`, {
        method: "PATCH",
      })
      if (!res.ok) throw new Error("Failed to update client")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}
