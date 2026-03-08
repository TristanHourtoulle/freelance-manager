"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { Badge } from "@/components/ui/badge"

import { KanbanTaskCard } from "./kanban-task-card"
import type { KanbanTask } from "../types"

interface KanbanColumnProps {
  statusName: string
  statusColor?: string
  tasks: KanbanTask[]
}

/**
 * A single status column in the Kanban board.
 * Acts as a droppable zone and renders a sorted list of task cards.
 */
export function KanbanColumn({
  statusName,
  statusColor,
  tasks,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: statusName })

  const taskIds = tasks.map((t) => t.linearIssueId)

  return (
    <div className="min-w-[280px] w-[280px] flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1">
        {statusColor && (
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
        )}
        <h3 className="text-sm font-semibold">{statusName}</h3>
        <Badge variant="secondary">{tasks.length}</Badge>
      </div>

      <div
        ref={setNodeRef}
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
