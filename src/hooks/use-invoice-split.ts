"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { InvoiceSplitInput } from "@/lib/schemas/invoice-split"

export interface SplitResult {
  items: { id: string; number: string; total: number; dueDate: string }[]
}

export function useSplitInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InvoiceSplitInput) =>
      api.post<SplitResult>("/api/invoices/split", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] })
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["nav-counts"] })
    },
  })
}
