import { cn } from "@/lib/utils"

type Dimension = number | string

interface SkeletonProps {
  width?: Dimension
  height?: Dimension
  radius?: Dimension
  className?: string
}

/**
 * Base shimmer placeholder that consumes the global `.skeleton` class.
 *
 * @param width - CSS width (number is treated as pixels).
 * @param height - CSS height (number is treated as pixels).
 * @param radius - CSS border-radius override (number is treated as pixels).
 * @param className - Extra classes composed with the `.skeleton` base.
 */
export function Skeleton({ width, height, radius, className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn("skeleton", className)}
      style={{ width, height, borderRadius: radius }}
    />
  )
}

interface SkeletonTextProps {
  lines?: number
  className?: string
}

/**
 * Stack of text-line placeholders; the last line is shortened.
 *
 * @param lines - Number of lines to render (defaults to 3).
 * @param className - Extra classes for the wrapping column.
 */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          height={12}
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  )
}

interface SkeletonRowProps {
  className?: string
}

/**
 * Table-row shaped placeholder: an avatar-sized block plus two text bars.
 *
 * @param className - Extra classes for the row wrapper.
 */
export function SkeletonRow({ className }: SkeletonRowProps) {
  return (
    <div className={cn("flex items-center gap-3 py-2", className)}>
      <Skeleton width={28} height={28} radius="var(--radius-sm)" />
      <Skeleton height={12} className="flex-1" />
      <Skeleton width={80} height={12} />
    </div>
  )
}

interface SkeletonCardProps {
  className?: string
}

/**
 * Generic card-shaped placeholder with a title bar and a text block.
 *
 * @param className - Extra classes for the card wrapper.
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[10px] border border-border bg-bg-1 p-5",
        className,
      )}
    >
      <Skeleton width="40%" height={14} />
      <SkeletonText lines={2} />
    </div>
  )
}

interface SkeletonKpiProps {
  className?: string
}

/**
 * KPI-tile shaped placeholder: a small label bar above a large value bar.
 *
 * @param className - Extra classes for the KPI wrapper.
 */
export function SkeletonKpi({ className }: SkeletonKpiProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[10px] border border-border border-l-2 border-l-accent bg-bg-1 p-5",
        className,
      )}
    >
      <Skeleton width="50%" height={11} />
      <Skeleton width="70%" height={24} />
    </div>
  )
}
