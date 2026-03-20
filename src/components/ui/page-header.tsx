import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  children?: React.ReactNode
  className?: string
}

/**
 * Standardized page header with title and optional action buttons.
 * Ensures consistent spacing and alignment across all dashboard pages.
 */
export function PageHeader({ title, children, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-4",
        className,
      )}
    >
      <h1 className="shrink-0">{title}</h1>
      {children && (
        <div className="flex shrink-0 items-center gap-3">{children}</div>
      )}
    </div>
  )
}
