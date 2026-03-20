"use client"

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  retryLabel?: string
  backHref?: string
  backLabel?: string
}

export function ErrorState({
  title = "Something went wrong",
  message = "An unexpected error occurred. Please try again.",
  onRetry,
  retryLabel = "Try again",
  backHref,
  backLabel = "Go back",
}: ErrorStateProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
        <ExclamationTriangleIcon className="size-7 text-red-500" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
      <div className="mt-6 flex items-center gap-2.5">
        {backHref && (
          <a href={backHref}>
            <Button
              variant="outline"
              shape={onRetry ? "pill-left" : "pill"}
              size="lg"
            >
              {backLabel}
            </Button>
          </a>
        )}
        {onRetry && (
          <Button
            variant="gradient"
            shape={backHref ? "pill-right" : "pill"}
            size="lg"
            onClick={onRetry}
          >
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
