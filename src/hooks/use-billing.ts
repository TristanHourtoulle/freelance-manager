"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import type {
  BillingApiResponse,
  HistoryApiResponse,
} from "@/components/billing/types"

/**
 * Fetches uninvoiced billing data. Cached for 10 minutes.
 */
export function useBilling(searchParams: string) {
  return useQuery<BillingApiResponse>({
    queryKey: ["billing", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/billing?${searchParams}`)
      if (!res.ok) throw new Error("Failed to fetch billing data")
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * Fetches billing history. Cached for 10 minutes.
 */
export function useBillingHistory(searchParams: string) {
  return useQuery<HistoryApiResponse>({
    queryKey: ["billing-history", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/billing/history?${searchParams}`)
      if (!res.ok) throw new Error("Failed to fetch billing history")
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * Marks tasks as invoiced.
 */
export function useMarkInvoiced() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (linearIssueIds: string[]) => {
      const res = await fetch("/api/billing/mark-invoiced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linearIssueIds }),
      })
      if (!res.ok) throw new Error("Failed to mark as invoiced")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] })
      queryClient.invalidateQueries({ queryKey: ["billing-history"] })
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["financial"] })
    },
  })
}

/**
 * Updates an invoice status with optimistic update.
 */
export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      invoiceId,
      status,
    }: {
      invoiceId: string
      status: "DRAFT" | "SENT" | "PAID"
    }) => {
      const res = await fetch(`/api/billing/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error("Failed to update invoice status")
      return res.json()
    },
    onMutate: async ({ invoiceId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["billing-history"] })
      const previousQueries = queryClient.getQueriesData<HistoryApiResponse>({
        queryKey: ["billing-history"],
      })

      queryClient.setQueriesData<HistoryApiResponse>(
        { queryKey: ["billing-history"] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            months: old.months.map((month) => ({
              ...month,
              clients: month.clients.map((client) => ({
                ...client,
                invoice:
                  client.invoice?.id === invoiceId
                    ? { ...client.invoice, status }
                    : client.invoice,
              })),
            })),
          }
        },
      )

      return { previousQueries }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-history"] })
      queryClient.invalidateQueries({ queryKey: ["financial"] })
    },
  })
}
