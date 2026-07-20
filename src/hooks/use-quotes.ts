"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { qk, STALE_TIME } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"
import type { QuoteCreateInput, QuoteUpdateInput } from "@/lib/schemas/quote"
import type { PaginatedResponse } from "@/lib/schemas/pagination"
import type {
  QuoteDetail,
  QuoteStatus,
  QuoteWireRow,
} from "@/domain/quotes/types"

export type {
  QuoteDetail,
  QuoteLineDTO,
  QuoteStatus,
  QuoteWireRow,
} from "@/domain/quotes/types"

export interface QuoteFilters {
  status?: QuoteStatus
  clientId?: string
}

function quotesQueryString(filters: QuoteFilters, cursor: string | null) {
  const params = new URLSearchParams({ limit: "50" })
  if (filters.status) params.set("status", filters.status)
  if (filters.clientId) params.set("clientId", filters.clientId)
  if (cursor) params.set("cursor", cursor)
  return params.toString()
}

/**
 * Paginated quote (devis) list, optionally scoped by status or client.
 *
 * @param filters - Server-side status and client filters.
 */
export function useQuotes(filters: QuoteFilters = {}) {
  return useInfiniteQuery({
    queryKey: qk.quotes(filters),
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<QuoteWireRow>>(
        `/api/quotes?${quotesQueryString(filters, pageParam)}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: STALE_TIME.list,
  })
}

export function useQuote(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.quote(id),
    queryFn: () => api.get<QuoteDetail>(`/api/quotes/${id}`),
    enabled: Boolean(id),
    staleTime: STALE_TIME.detail,
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (input: QuoteCreateInput) =>
      api.post<QuoteWireRow>("/api/quotes", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.quotesAll() })
      qc.invalidateQueries({ queryKey: qk.analyticsAll() })
      toast({ variant: "success", title: "Devis créé" })
    },
    onError: () => {
      toast({ variant: "error", title: "Impossible de créer le devis" })
    },
  })
}

export function useUpdateQuote(id: string) {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (input: Partial<QuoteUpdateInput>) =>
      api.patch<QuoteWireRow>(`/api/quotes/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.quotesAll() })
      qc.invalidateQueries({ queryKey: qk.quote(id) })
      qc.invalidateQueries({ queryKey: qk.analyticsAll() })
      toast({ variant: "success", title: "Devis mis à jour" })
    },
    onError: () => {
      toast({ variant: "error", title: "Impossible de modifier le devis" })
    },
  })
}

export function useSetQuoteStatus() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (input: { id: string; status: QuoteStatus }) =>
      api.patch<QuoteWireRow>(`/api/quotes/${input.id}`, {
        status: input.status,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.quotesAll() })
      qc.invalidateQueries({ queryKey: qk.quote(vars.id) })
      qc.invalidateQueries({ queryKey: qk.analyticsAll() })
      toast({ variant: "success", title: "Statut du devis mis à jour" })
    },
    onError: () => {
      toast({ variant: "error", title: "Impossible de changer le statut" })
    },
  })
}

export function useDeleteQuote() {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/quotes/${id}`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.quotesAll() })
      qc.invalidateQueries({ queryKey: qk.quote(id) })
      qc.invalidateQueries({ queryKey: qk.analyticsAll() })
      toast({ variant: "success", title: "Devis supprimé" })
    },
    onError: () => {
      toast({ variant: "error", title: "Impossible de supprimer le devis" })
    },
  })
}
