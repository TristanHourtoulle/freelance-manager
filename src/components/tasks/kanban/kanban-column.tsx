"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { Badge } from "@/components/ui/badge"

import { KanbanTaskCard } from "./kanban-task-card"
import { TaskStatusBadge } from "../task-status-badge"
import type { KanbanTask, TaskStatusDTO } from "../types"

interface KanbanColumnProps {
  status: TaskStatusDTO
  tasks: KanbanTask[]
}

/**
 * A single status column in the Kanban board.
 * Acts as a droppable zone and renders a sorted list of task cards.
 * Shows a pulsing dashed border when a card is being dragged over.
 */
export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status.name })

  const taskIds = tasks.map((t) => t.linearIssueId)

  return (
    <div className="min-w-[280px] w-[280px] flex-shrink-0 flex flex-col lg:w-auto lg:min-w-0 lg:flex-1">
      <div className="flex items-center gap-2 mb-3 px-1">
        <TaskStatusBadge status={status} />
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <div
        ref={setNodeRef}
        role="region"
        aria-label={status.name}
        className={`
          flex-1 flex flex-col gap-2 p-2 rounded-lg min-h-[200px]
          transition-all duration-200
          ${
            isOver
              ? "bg-primary/5 border-2 border-dashed border-primary/50"
              : "bg-muted/30 border-2 border-transparent"
          }
        `}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanTaskCard key={task.linearIssueId} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
