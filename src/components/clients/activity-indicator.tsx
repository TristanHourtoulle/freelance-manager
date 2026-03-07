"use client"

const MS_PER_DAY = 86_400_000

interface ActivityIndicatorProps {
  lastActivityAt: string | null
  showLabel?: boolean
}

function getRelativeLabel(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / MS_PER_DAY)

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 30) return `${diffDays}d ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) return `${diffMonths}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function getDotColor(lastActivityAt: string | null): string {
  if (!lastActivityAt) return "bg-red-500"

  const diffDays = Math.floor(
    (Date.now() - new Date(lastActivityAt).getTime()) / MS_PER_DAY,
  )

  if (diffDays < 7) return "bg-green-500"
  if (diffDays < 30) return "bg-amber-500"
  return "bg-red-500"
}

export function ActivityIndicator({
  lastActivityAt,
  showLabel = true,
}: ActivityIndicatorProps) {
  const dotColor = getDotColor(lastActivityAt)
  const label = lastActivityAt
    ? getRelativeLabel(new Date(lastActivityAt))
    : "No activity"

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${dotColor}`}
      />
      {showLabel && (
        <span className="text-xs text-text-secondary">{label}</span>
      )}
    </div>
  )
}
