interface PageToolbarProps {
  children: React.ReactNode
}

/**
 * Standardized toolbar container for filters, search, and status indicators.
 * Groups all toolbar elements in a visually cohesive section with subtle background.
 */
export function PageToolbar({ children }: PageToolbarProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  )
}
