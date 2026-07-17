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

export type InvoiceDocStatus = "DRAFT" | "SENT" | "CANCELLED"
export type InvoicePaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERPAID"

export interface InvoicePaymentDTO {
  id: string
  amount: number
  paidAt: string
  method: string | null
  note: string | null
  createdAt: string
}

export interface InvoiceListItem {
  id: string
  number: string
  clientId: string
  projectId: string | null
  status: InvoiceDocStatus
  paymentStatus: InvoicePaymentStatus
  isOverdue: boolean
  kind: "STANDARD" | "DEPOSIT"
  issueDate: string
  dueDate: string
  paidAmount: number
  balanceDue: number
  lastPaidAt: string | null
  subtotal: number
  tax: number
  total: number
  totalOverride: number | null
  notes: string | null
  linesCount: number
}

export interface InvoiceDetail extends InvoiceListItem {
  client: {
    id: string
    firstName: string
    lastName: string
    company: string | null
    email: string | null
    billingMode: "DAILY" | "FIXED" | "HOURLY"
    color: string | null
  }
  lines: {
    id: string
    taskId: string | null
    label: string
    qty: number
    rate: number
  }[]
  payments: InvoicePaymentDTO[]
}

export function useInvoices() {
  return useInfiniteQuery({
    queryKey: qk.invoices(),
    queryFn: ({ pageParam }) =>
      api.get<PaginatedResponse<InvoiceListItem>>(
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
