"use client"

import { ErrorState } from "@/components/ui/error-state"

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="Authentication error"
      message={error.message || "Something went wrong during authentication."}
      onRetry={reset}
      backHref="/auth/login"
      backLabel="Back to login"
    />
  )
}
