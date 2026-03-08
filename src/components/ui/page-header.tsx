interface PageHeaderProps {
  title: string
  children?: React.ReactNode
}

/**
 * Standardized page header with title and optional action buttons.
 * Ensures consistent spacing and alignment across all dashboard pages.
 */
export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h1>{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
