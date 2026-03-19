"use client"

import { useState, useMemo, useCallback } from "react"
import { useTranslations } from "next-intl"
import {
  DndContext,
  DragOverlay,
  pointerWithin,
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
  onStatusChange: (linearIssueId: string, newStatus: TaskStatusDTO) => void
}

/**
 * Kanban board that groups tasks by workflow status into draggable columns.
 * Supports drag-and-drop to change task status via the onStatusChange callback.
 */
export function TaskKanbanBoard({
  tasks,
  onStatusChange,
}: TaskKanbanBoardProps) {
  const t = useTranslations("taskTable")
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const columns = useMemo(() => {
    const columnMap = new Map<string, StatusColumn>()

    for (const task of tasks) {
      const statusName = task.status?.name ?? t("noStatus")
      const existing = columnMap.get(statusName)

      if (existing) {
        existing.tasks = [...existing.tasks, task]
      } else {
        columnMap.set(statusName, {
          status: task.status ?? {
            id: "",
            name: t("noStatus"),
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
  }, [tasks, t])

  /** Set of all column droppable IDs (status names). */
  const columnNames = useMemo(
    () => new Set(columns.map((c) => c.status.name)),
    [columns],
  )

  /** Lookup from task ID to its column's status name. */
  const taskColumnMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const col of columns) {
      for (const task of col.tasks) {
        map.set(task.linearIssueId, col.status.name)
      }
    }
    return map
  }, [columns])

  /** Lookup from status name to full status DTO. */
  const statusByName = useMemo(() => {
    const map = new Map<string, TaskStatusDTO>()
    for (const col of columns) {
      if (!map.has(col.status.name)) {
        map.set(col.status.name, col.status)
      }
    }
    return map
  }, [columns])

  const activeTask = useMemo(
    () => tasks.find((tk) => tk.linearIssueId === activeTaskId) ?? null,
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
      const overId = over.id as string

      // Resolve target column: over.id can be a column name or a task ID
      const targetColumnName = columnNames.has(overId)
        ? overId
        : taskColumnMap.get(overId)

      if (!targetColumnName) return

      const draggedTask = tasks.find((tk) => tk.linearIssueId === taskId)
      if (!draggedTask) return

      const currentStatus = draggedTask.status?.name ?? t("noStatus")
      if (currentStatus === targetColumnName) return

      const targetStatus = statusByName.get(targetColumnName)
      if (!targetStatus || !targetStatus.id) return

      onStatusChange(taskId, targetStatus)
    },
    [tasks, onStatusChange, statusByName, columnNames, taskColumnMap, t],
  )

  return (
    <DndContext
      collisionDetection={pointerWithin}
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
