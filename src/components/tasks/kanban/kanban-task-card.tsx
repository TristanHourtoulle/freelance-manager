"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useTranslations } from "next-intl"
import Link from "next/link"

import type { KanbanTask } from "../types"

interface KanbanTaskCardProps {
  task: KanbanTask
  isDragOverlay?: boolean
}

/** Formats a number as EUR currency using fr-FR locale. */
function formatEur(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value)
}

/**
 * A compact, draggable card representing a single task in the Kanban board.
 * Shows identifier, title, client name, estimate, and billing amount.
 */
export function KanbanTaskCard({ task, isDragOverlay }: KanbanTaskCardProps) {
  const t = useTranslations("taskTable")
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.linearIssueId })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const cardContent = (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...(isDragOverlay ? {} : attributes)}
      {...(isDragOverlay ? {} : listeners)}
      className={`
        bg-card rounded-lg border border-border p-3
        hover:shadow-md transition-shadow cursor-grab
        ${isDragOverlay ? "shadow-lg rotate-2" : ""}
      `}
    >
      <p className="text-xs text-muted-foreground font-mono">
        {task.identifier}
      </p>
      <p className="text-sm font-medium mt-1 line-clamp-2">{task.title}</p>
      <p className="text-xs text-muted-foreground mt-1">{task.clientName}</p>
      {task.projectName && (
        <p className="text-xs text-muted-foreground/70 mt-0.5">
          {task.projectName}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5">
          {task.estimate !== undefined ? (
            <span className="text-xs text-muted-foreground">
              {task.estimate}h
            </span>
          ) : (
            <span />
          )}
          {task.paid && (
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
              {t("paid")}
            </span>
          )}
        </div>
        <span className="text-xs font-medium">
          {formatEur(task.billingAmount)}
        </span>
      </div>
    </div>
  )

  if (isDragOverlay) {
    return cardContent
  }

  return (
    <Link
      href={`/tasks/${task.linearIssueId}`}
      onClick={(e) => {
        if (isDragging) {
          e.preventDefault()
        }
      }}
      draggable={false}
    >
      {cardContent}
    </Link>
  )
}
