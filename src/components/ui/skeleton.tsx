interface SkeletonProps {
  className?: string
}

/**
 * Animated placeholder block used as a loading skeleton.
 * Size and shape are controlled entirely via className.
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded bg-surface-muted ${className}`} />
  )
}
