interface CardProps {
  title?: string
  children: React.ReactNode
  className?: string
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {title && (
        <h3 className="mb-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}
