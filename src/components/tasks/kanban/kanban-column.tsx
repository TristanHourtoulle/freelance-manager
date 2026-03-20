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
 */
export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status.name })

  const taskIds = tasks.map((t) => t.linearIssueId)

  return (
    <div className="min-w-[280px] w-[280px] flex flex-col">
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
          transition-colors
          ${isOver ? "bg-accent/50" : "bg-muted/30"}
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
