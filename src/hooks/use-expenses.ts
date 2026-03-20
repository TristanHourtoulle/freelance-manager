"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import type {
  CreateExpenseInput,
  UpdateExpenseInput,
} from "@/lib/schemas/expense"

interface SerializedExpense {
  id: string
  userId: string
  clientId: string | null
  clientName: string | null
  category: string
  description: string
  amount: number
  date: string
  recurring: boolean
  receiptUrl: string | null
  createdAt: string
  updatedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface ExpensesResponse {
  items: SerializedExpense[]
  pagination: Pagination
}

export type { SerializedExpense, ExpensesResponse }

/**
 * Fetches expenses list with filters. Cached for 5 minutes.
 */
export function useExpenses(searchParams: string) {
  return useQuery<ExpensesResponse>({
    queryKey: ["expenses", searchParams],
    queryFn: async () => {
      const res = await fetch(`/api/expenses?${searchParams}`)
      if (!res.ok) throw new Error("Failed to fetch expenses")
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Creates a new expense. Invalidates the expenses cache on success.
 */
export function useCreateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to create expense")
      return res.json() as Promise<SerializedExpense>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}

/**
 * Updates an existing expense. Invalidates the expenses cache on success.
 */
export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: UpdateExpenseInput
    }) => {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error("Failed to update expense")
      return res.json() as Promise<SerializedExpense>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}

/**
 * Deletes an expense. Invalidates the expenses cache on success.
 */
export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete expense")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
    },
  })
}
