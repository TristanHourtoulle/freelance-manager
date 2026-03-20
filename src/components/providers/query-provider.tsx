"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

interface QueryProviderProps {
  children: React.ReactNode
}

/**
 * TanStack Query provider with default configuration.
 * Provides caching, deduplication, and stale-while-revalidate for all data fetching.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              if (error instanceof Error && error.message.includes("401"))
                return false
              return failureCount < 1
            },
          },
          mutations: {
            onError: (error) => {
              if (
                error instanceof Error &&
                error.message.includes("401") &&
                typeof window !== "undefined"
              ) {
                window.location.href = "/"
              }
            },
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
