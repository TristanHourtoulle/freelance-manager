import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  className?: string
}

/**
 * Stat card matching the Figma design system.
 * White card with thick border, uppercase label, and bold value.
 */
export function StatCard({ label, value, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-border bg-surface p-4 sm:p-5",
        className,
      )}
    >
      <span className="truncate text-xs font-medium uppercase tracking-wide text-text-secondary sm:text-sm">
        {label}
      </span>
      <span className="truncate text-xl font-bold text-text-primary sm:text-2xl">
        {value}
      </span>
    </div>
  )
}

interface StatCardGroupProps {
  children: React.ReactNode
  className?: string
}

/**
 * Responsive grid of stat cards. 2 columns on mobile, 4 on desktop.
 */
export function StatCardGroup({ children, className }: StatCardGroupProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6",
        className,
      )}
    >
      {children}
    </div>
  )
}
