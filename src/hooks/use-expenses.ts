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
      queryClient.invalidateQueries({ queryKey: ["financial"] })
    },
  })
}

/**
 * Updates an existing expense with optimistic cache update.
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
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["expenses"] })
      const previousQueries = queryClient.getQueriesData<ExpensesResponse>({
        queryKey: ["expenses"],
      })

      queryClient.setQueriesData<ExpensesResponse>(
        { queryKey: ["expenses"] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    description: data.description ?? item.description,
                    amount:
                      data.amount !== undefined ? data.amount : item.amount,
                    category: data.category ?? item.category,
                    recurring: data.recurring ?? item.recurring,
                  }
                : item,
            ),
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
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      queryClient.invalidateQueries({ queryKey: ["financial"] })
    },
  })
}

/**
 * Deletes an expense with optimistic cache update.
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["expenses"] })
      const previousQueries = queryClient.getQueriesData<ExpensesResponse>({
        queryKey: ["expenses"],
      })

      queryClient.setQueriesData<ExpensesResponse>(
        { queryKey: ["expenses"] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            items: old.items.filter((item) => item.id !== id),
            pagination: {
              ...old.pagination,
              total: old.pagination.total - 1,
            },
          }
        },
      )

      return { previousQueries }
    },
    onError: (_err, _id, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      queryClient.invalidateQueries({ queryKey: ["financial"] })
    },
  })
}
