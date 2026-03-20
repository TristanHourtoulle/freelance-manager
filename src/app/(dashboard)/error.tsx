"use client"

import { ErrorState } from "@/components/ui/error-state"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isDev = process.env.NODE_ENV === "development"
  const message = isDev
    ? `${error.message}${error.digest ? ` (digest: ${error.digest})` : ""}`
    : "An unexpected error occurred."

  return (
    <div className="flex flex-col items-center">
      <ErrorState
        title="Something went wrong"
        message={message}
        onRetry={reset}
        backHref="/dashboard"
        backLabel="Go to Dashboard"
      />
      {isDev && error.stack && (
        <pre className="mt-4 max-w-2xl overflow-auto rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground">
          {error.stack}
        </pre>
      )}
    </div>
  )
}
