"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type {
  InvoiceCreateInput,
  InvoiceUpdateInput,
} from "@/lib/schemas/invoice"
import type {
  PaymentCreateInput,
  PaymentUpdateInput,
} from "@/lib/schemas/payment"

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
  return useQuery({
    queryKey: ["invoices"] as const,
    queryFn: () => api.get<{ items: InvoiceListItem[] }>("/api/invoices"),
    select: (d) => d.items,
    staleTime: 30_000,
  })
}

export function useInvoice(id: string | null | undefined) {
  return useQuery({
    queryKey: ["invoice", id] as const,
    queryFn: () => api.get<InvoiceDetail>(`/api/invoices/${id}`),
    enabled: Boolean(id),
    staleTime: 60_000,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InvoiceCreateInput) =>
      api.post<{ id: string }>("/api/invoices", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
    },
  })
}

export function useUpdateInvoice(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InvoiceUpdateInput) =>
      api.patch(`/api/invoices/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["invoice", id] })
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
    },
  })
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; status: InvoiceDocStatus }) =>
      api.patch(`/api/invoices/${input.id}`, { status: input.status }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["invoice", vars.id] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
    },
  })
}

export function useCreatePayment(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PaymentCreateInput) =>
      api.post<InvoicePaymentDTO>(`/api/invoices/${invoiceId}/payments`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
    },
  })
}

export function useUpdatePayment(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { paymentId: string } & PaymentUpdateInput) => {
      const { paymentId, ...rest } = input
      return api.patch<InvoicePaymentDTO>(
        `/api/invoices/${invoiceId}/payments/${paymentId}`,
        rest,
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useDeletePayment(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (paymentId: string) =>
      api.delete(`/api/invoices/${invoiceId}/payments/${paymentId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
