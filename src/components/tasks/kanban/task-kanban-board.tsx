"use client"

import { useState, useMemo, useCallback } from "react"
import {
  DndContext,
  closestCorners,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"

import { KanbanColumn } from "./kanban-column"
import { KanbanTaskCard } from "./kanban-task-card"
import type { KanbanTask, TaskStatusDTO } from "../types"

/** Priority ordering for known Linear workflow state types. */
const STATUS_TYPE_ORDER: Record<string, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  cancelled: 4,
}

interface StatusColumn {
  status: TaskStatusDTO
  tasks: KanbanTask[]
}

interface TaskKanbanBoardProps {
  tasks: KanbanTask[]
  onStatusChange: (
    linearIssueId: string,
    newStatusName: string,
    newStatusId: string,
  ) => void
}

/**
 * Kanban board that groups tasks by workflow status into draggable columns.
 * Supports drag-and-drop to change task status via the onStatusChange callback.
 */
export function TaskKanbanBoard({
  tasks,
  onStatusChange,
}: TaskKanbanBoardProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const columns = useMemo(() => {
    const columnMap = new Map<string, StatusColumn>()

    for (const task of tasks) {
      const statusName = task.status?.name ?? "No Status"
      const existing = columnMap.get(statusName)

      if (existing) {
        existing.tasks.push(task)
      } else {
        columnMap.set(statusName, {
          status: task.status ?? {
            id: "",
            name: "No Status",
            type: "backlog",
            color: "#95a2b3",
          },
          tasks: [task],
        })
      }
    }

    return [...columnMap.values()].sort((a, b) => {
      const orderA = STATUS_TYPE_ORDER[a.status.type] ?? 999
      const orderB = STATUS_TYPE_ORDER[b.status.type] ?? 999
      return orderA - orderB
    })
  }, [tasks])

  /** Lookup from status name to status ID, derived from the first task in each column. */
  const statusIdByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const task of tasks) {
      const name = task.status?.name
      if (name && task.status?.id && !map.has(name)) {
        map.set(name, task.status.id)
      }
    }
    return map
  }, [tasks])

  const activeTask = useMemo(
    () => tasks.find((t) => t.linearIssueId === activeTaskId) ?? null,
    [tasks, activeTaskId],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTaskId(null)

      const { active, over } = event
      if (!over) return

      const taskId = active.id as string
      const targetColumnName = over.id as string

      const draggedTask = tasks.find((t) => t.linearIssueId === taskId)
      if (!draggedTask) return

      const currentStatus = draggedTask.status?.name ?? "No Status"
      if (currentStatus === targetColumnName) return

      const targetStatusId = statusIdByName.get(targetColumnName)
      if (!targetStatusId) return

      onStatusChange(taskId, targetColumnName, targetStatusId)
    },
    [tasks, onStatusChange, statusIdByName],
  )

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4">
          {columns.map((column) => (
            <KanbanColumn
              key={column.status.name}
              status={column.status}
              tasks={column.tasks}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? <KanbanTaskCard task={activeTask} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
