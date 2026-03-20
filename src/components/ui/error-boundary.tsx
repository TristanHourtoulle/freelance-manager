"use client"

import { Component, type ReactNode } from "react"
import { ErrorState } from "@/components/ui/error-state"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * React Error Boundary that catches render errors in children
 * and displays a fallback UI with retry capability.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  private handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    const { children, fallback } = this.props

    if (!error) {
      return children
    }

    if (fallback) {
      return typeof fallback === "function"
        ? fallback(error, this.handleReset)
        : fallback
    }

    return (
      <ErrorState
        title="Something went wrong"
        message={error.message || "An unexpected error occurred."}
        onRetry={this.handleReset}
      />
    )
  }
}

/**
 * HOC that wraps a component with an ErrorBoundary.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ErrorBoundaryProps["fallback"],
) {
  function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    )
  }

  WithErrorBoundary.displayName = `withErrorBoundary(${WrappedComponent.displayName ?? WrappedComponent.name ?? "Component"})`

  return WithErrorBoundary
}
