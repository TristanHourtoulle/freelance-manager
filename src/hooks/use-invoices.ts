"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { invalidateInvoiceGraph, qk, STALE_TIME } from "@/hooks/query-keys"
import type {
  InvoiceCreateInput,
  InvoiceUpdateInput,
} from "@/lib/schemas/invoice"
import type {
  PaymentCreateInput,
  PaymentUpdateInput,
} from "@/lib/schemas/payment"
import type { PaginatedResponse } from "@/lib/schemas/pagination"
import type {
  InvoiceDetail,
  InvoiceDocStatus,
  InvoicePaymentDTO,
  InvoiceWireRow,
} from "@/domain/billing/types"

export type {
  InvoiceDetail,
  InvoiceDocStatus,
  InvoiceKind,
  InvoicePaymentDTO,
  InvoicePaymentStatus,
  InvoiceWireRow,
} from "@/domain/billing/types"

export function useInvoices() {
  return useInfiniteQuery({
    queryKey: qk.invoices(),
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<InvoiceWireRow>>(
        `/api/invoices?limit=50${pageParam ? `&cursor=${pageParam}` : ""}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (d) => d.pages.flatMap((p) => p.data),
    staleTime: STALE_TIME.hour,
  })
}

export function useInvoice(id: string | null | undefined) {
  return useQuery({
    queryKey: qk.invoice(id),
    queryFn: () => api.get<InvoiceDetail>(`/api/invoices/${id}`),
    enabled: Boolean(id),
    staleTime: STALE_TIME.detail,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (input: InvoiceCreateInput) =>
      api.post<{ id: string }>("/api/invoices", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices() })
      qc.invalidateQueries({ queryKey: qk.tasks.all() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      router.refresh()
    },
  })
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (input: InvoiceUpdateInput) =>
      api.patch(`/api/invoices/${id}`, input),
    onSuccess: () => {
      invalidateInvoiceGraph(qc, id)
      qc.invalidateQueries({ queryKey: qk.tasks.all() })
      router.refresh()
    },
  })
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (input: { id: string; status: InvoiceDocStatus }) =>
      api.patch(`/api/invoices/${input.id}`, { status: input.status }),
    onSuccess: (_d, vars) => {
      invalidateInvoiceGraph(qc, vars.id)
      router.refresh()
    },
  })
}

export function useCreatePayment(invoiceId: string) {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (input: PaymentCreateInput) =>
      api.post<InvoicePaymentDTO>(`/api/invoices/${invoiceId}/payments`, input),
    onSuccess: () => {
      invalidateInvoiceGraph(qc, invoiceId)
      router.refresh()
    },
  })
}

export function useUpdatePayment(invoiceId: string) {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (input: { paymentId: string } & PaymentUpdateInput) => {
      const { paymentId, ...rest } = input
      return api.patch<InvoicePaymentDTO>(
        `/api/invoices/${invoiceId}/payments/${paymentId}`,
        rest,
      )
    },
    onSuccess: () => {
      invalidateInvoiceGraph(qc, invoiceId)
      router.refresh()
    },
  })
}

export function useDeletePayment(invoiceId: string) {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (paymentId: string) =>
      api.delete(`/api/invoices/${invoiceId}/payments/${paymentId}`),
    onSuccess: () => {
      invalidateInvoiceGraph(qc, invoiceId)
      router.refresh()
    },
  })
}
