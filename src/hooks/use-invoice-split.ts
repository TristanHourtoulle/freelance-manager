"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { qk } from "@/hooks/query-keys"
import type { InvoiceSplitInput } from "@/lib/schemas/invoice-split"

export interface SplitResult {
  items: { id: string; number: string; total: number; dueDate: string }[]
}

export function useSplitInvoice() {
  const qc = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationFn: (input: InvoiceSplitInput) =>
      api.post<SplitResult>("/api/invoices/split", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices() })
      qc.invalidateQueries({ queryKey: qk.tasks.all() })
      qc.invalidateQueries({ queryKey: qk.dashboard() })
      router.refresh()
    },
  })
}
