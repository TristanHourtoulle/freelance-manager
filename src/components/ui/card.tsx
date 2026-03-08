interface CardProps {
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Generic container card with an optional title header.
 * Used as a layout primitive in dashboard pages and detail views.
 *
 * @param title - Optional heading rendered above the card content
 */
export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-6 ${className}`}
    >
      {title && <h3 className="mb-4">{title}</h3>}
      {children}
    </div>
  )
}
