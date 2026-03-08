import { cn } from "@/lib/utils"

import type { TaskStatusDTO } from "./types"

/** Maps Linear workflow state types to semantic icon shapes. */
const STATUS_TYPE_ICONS: Record<string, (color: string) => React.ReactNode> = {
  backlog: (color) => (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0">
      <circle
        cx="6"
        cy="6"
        r="4.5"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="2.5 2.5"
      />
    </svg>
  ),
  unstarted: (color) => (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0">
      <circle
        cx="6"
        cy="6"
        r="4.5"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  ),
  started: (color) => (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0">
      <circle
        cx="6"
        cy="6"
        r="4.5"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <path d="M6 1.5 A4.5 4.5 0 0 1 6 10.5" fill={color} stroke="none" />
    </svg>
  ),
  completed: (color) => (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0">
      <circle cx="6" cy="6" r="4.5" fill={color} stroke="none" />
      <path
        d="M4 6.2 L5.4 7.5 L8 4.5"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  cancelled: (color) => (
    <svg viewBox="0 0 12 12" className="size-3 shrink-0">
      <circle cx="6" cy="6" r="4.5" fill={color} stroke="none" />
      <path
        d="M4.25 4.25 L7.75 7.75 M7.75 4.25 L4.25 7.75"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
}

function getStatusIcon(type: string, color: string): React.ReactNode {
  const iconFn = STATUS_TYPE_ICONS[type]
  if (iconFn) return iconFn(color)

  return (
    <span
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  )
}

interface TaskStatusBadgeProps {
  status: TaskStatusDTO
  size?: "sm" | "md"
  className?: string
}

/**
 * Renders a task status badge with a Linear-style icon matching the workflow
 * state type (backlog, unstarted, started, completed, cancelled).
 */
export function TaskStatusBadge({
  status,
  size = "sm",
  className,
}: TaskStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium whitespace-nowrap",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-2.5 py-1 text-sm",
        className,
      )}
      style={{
        backgroundColor: `${status.color}12`,
        borderColor: `${status.color}30`,
        color: status.color,
      }}
    >
      {getStatusIcon(status.type, status.color)}
      {status.name}
    </span>
  )
}
