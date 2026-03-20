"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import type { ImportBankTransactionsInput } from "@/lib/schemas/bank-transaction"

interface SerializedBankTransaction {
  id: string
  userId: string
  date: string
  description: string
  amount: number
  bankName: string | null
  matchedExpenseId: string | null
  importedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface BankTransactionsResponse {
  items: SerializedBankTransaction[]
  pagination: Pagination
}

export type { SerializedBankTransaction, BankTransactionsResponse }

/**
 * Fetches bank transactions with pagination and filters. Cached for 5 minutes.
 */
export function useBankTransactions(searchParams: string) {
  return useQuery<BankTransactionsResponse>({
    queryKey: ["bank-transactions", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/bank-transactions?${searchParams}`)
      if (!res.ok) throw new Error("Failed to fetch bank transactions")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Imports bank transactions from parsed CSV data.
 * Invalidates the bank-transactions cache on success.
 */
export function useImportBankTransactions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ImportBankTransactionsInput) => {
      const res = await fetch("/api/bank-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to import bank transactions")
      return res.json() as Promise<{ count: number }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] })
    },
  })
}

/**
 * Uploads a CSV file for bank transaction import.
 * Invalidates the bank-transactions cache on success.
 */
export function useUploadBankCsv() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/import/bank-transactions", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error?.error?.message ?? "Failed to upload CSV")
      }
      return res.json() as Promise<{ count: number; bankName: string }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] })
    },
  })
}

/**
 * Matches or unmatches a bank transaction to an expense.
 * Invalidates the bank-transactions cache on success.
 */
export function useMatchBankTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      matchedExpenseId,
    }: {
      id: string
      matchedExpenseId: string | null
    }) => {
      const res = await fetch(`/api/bank-transactions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchedExpenseId }),
      })
      if (!res.ok) throw new Error("Failed to match bank transaction")
      return res.json() as Promise<SerializedBankTransaction>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] })
    },
  })
}

/**
 * Deletes a bank transaction.
 * Invalidates the bank-transactions cache on success.
 */
export function useDeleteBankTransaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bank-transactions/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete bank transaction")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] })
    },
  })
}
