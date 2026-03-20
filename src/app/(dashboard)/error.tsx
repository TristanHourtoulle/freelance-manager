"use client"

import { ErrorState } from "@/components/ui/error-state"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Something went wrong"
      message={error.message || "An unexpected error occurred."}
      onRetry={reset}
      backHref="/dashboard"
      backLabel="Go to Dashboard"
    />
  )
}
