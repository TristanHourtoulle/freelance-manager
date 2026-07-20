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
    <div aria-hidden className={cn("flex flex-col gap-2", className)}>
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
    <div aria-hidden className={cn("flex items-center gap-3 py-2", className)}>
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
 * Reuses the global `.card` class so the placeholder keeps the exact padding,
 * border and radius of the card that replaces it.
 *
 * @param className - Extra classes for the card wrapper, e.g. `card-tight`.
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div aria-hidden className={cn("card flex flex-col gap-3", className)}>
      <Skeleton width="40%" height={14} />
      <SkeletonText lines={2} />
    </div>
  )
}

interface SkeletonKpiProps {
  className?: string
}

/**
 * KPI-tile shaped placeholder: a label bar, a value bar and a sub bar.
 *
 * Reuses the global `.kpi` class and its inner `.kpi-label` / `.kpi-value` /
 * `.kpi-sub` structure so the placeholder is geometrically identical to the
 * real tile and does not shift the layout when the data lands.
 *
 * @param className - Extra classes for the KPI wrapper, typically the same
 * variant modifier as the real tile (`kpi-accent`, `kpi-warn`, `kpi-info`,
 * `k-revenue`, `k-outstanding`, `k-overdue`).
 */
export function SkeletonKpi({ className }: SkeletonKpiProps) {
  return (
    <div aria-hidden className={cn("kpi", className)}>
      <div className="kpi-label h-[1.5em]">
        <Skeleton width="60%" height="0.75em" />
      </div>
      <div className="kpi-value flex h-[1.5em] items-center">
        <Skeleton width="45%" height="0.7em" />
      </div>
      <div className="kpi-sub h-[1.5em]">
        <Skeleton width="55%" height="0.75em" />
      </div>
    </div>
  )
}
