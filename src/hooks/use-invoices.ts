"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { InvoiceCreateInput } from "@/lib/schemas/invoice"

export interface InvoiceListItem {
  id: string
  number: string
  clientId: string
  projectId: string | null
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE"
  kind: "STANDARD" | "DEPOSIT"
  issueDate: string
  dueDate: string
  paidAt: string | null
  subtotal: number
  tax: number
  total: number
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

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      id: string
      status: "DRAFT" | "SENT" | "PAID" | "OVERDUE"
      paidAt?: string
    }) =>
      api.patch(`/api/invoices/${input.id}`, {
        status: input.status,
        paidAt: input.paidAt,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["invoice", vars.id] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
    },
  })
}
