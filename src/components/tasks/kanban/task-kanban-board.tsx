"use client"

import { useState, useMemo, useCallback } from "react"
import { useTranslations } from "next-intl"
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"

import { KanbanColumn } from "./kanban-column"
import { KanbanTaskCard } from "./kanban-task-card"
import type { KanbanTask, TaskStatusDTO } from "../types"

/** localStorage key used to persist within-column task order. */
const STORAGE_KEY = "fm-kanban-order"

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

/** Reads stored task order from localStorage. */
function loadStoredOrder(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, string[]>
    }
    return {}
  } catch {
    return {}
  }
}

/** Persists task order to localStorage. */
function saveStoredOrder(order: Record<string, string[]>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
  } catch {
    // Silently fail if storage is full or unavailable
  }
}

/** Sorts tasks within a column according to stored order. Unrecognized tasks go at the end. */
function applyStoredOrder(tasks: KanbanTask[], order: string[]): KanbanTask[] {
  const positionMap = new Map<string, number>()
  for (let i = 0; i < order.length; i++) {
    const id = order[i]
    if (id !== undefined) {
      positionMap.set(id, i)
    }
  }

  return [...tasks].sort((a, b) => {
    const posA = positionMap.get(a.linearIssueId) ?? Number.MAX_SAFE_INTEGER
    const posB = positionMap.get(b.linearIssueId) ?? Number.MAX_SAFE_INTEGER
    return posA - posB
  })
}

/**
 * Kanban board that groups tasks by workflow status into draggable columns.
 * Supports drag-and-drop to change task status and reorder within columns.
 * Persists within-column ordering to localStorage.
 */
export function TaskKanbanBoard({
  tasks,
  onStatusChange,
}: TaskKanbanBoardProps) {
  const t = useTranslations("taskTable")
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [_hoveredColumnId, setHoveredColumnId] = useState<string | null>(null)

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

    // Sort columns by status type order
    const sorted = [...columnMap.values()].sort((a, b) => {
      const orderA = STATUS_TYPE_ORDER[a.status.type] ?? 999
      const orderB = STATUS_TYPE_ORDER[b.status.type] ?? 999
      return orderA - orderB
    })

    // Apply stored within-column order
    const storedOrder = loadStoredOrder()
    return sorted.map((col) => {
      const order = storedOrder[col.status.name]
      if (order && order.length > 0) {
        return { ...col, tasks: applyStoredOrder(col.tasks, order) }
      }
      return col
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

  /** Saves current column orders to localStorage. */
  const persistColumnOrders = useCallback(
    (updatedColumns?: StatusColumn[]) => {
      const cols = updatedColumns ?? columns
      const order: Record<string, string[]> = {}
      for (const col of cols) {
        order[col.status.name] = col.tasks.map((t) => t.linearIssueId)
      }
      saveStoredOrder(order)
    },
    [columns],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event
      if (!over) {
        setHoveredColumnId(null)
        return
      }

      const overId = over.id as string
      const targetColumn = columnNames.has(overId)
        ? overId
        : (taskColumnMap.get(overId) ?? null)

      setHoveredColumnId(targetColumn)
    },
    [columnNames, taskColumnMap],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTaskId(null)
      setHoveredColumnId(null)

      const { active, over } = event
      if (!over) return

      const taskId = active.id as string
      const overId = over.id as string

      const draggedTask = tasks.find((tk) => tk.linearIssueId === taskId)
      if (!draggedTask) return

      const sourceColumnName = draggedTask.status?.name ?? t("noStatus")

      // Resolve target column: over.id can be a column name or a task ID
      const targetColumnName = columnNames.has(overId)
        ? overId
        : taskColumnMap.get(overId)

      if (!targetColumnName) return

      // Within-column reorder
      if (sourceColumnName === targetColumnName) {
        const column = columns.find((c) => c.status.name === sourceColumnName)
        if (!column) return

        const taskIds = column.tasks.map((t) => t.linearIssueId)
        const oldIndex = taskIds.indexOf(taskId)
        const overTaskIndex = taskIds.indexOf(overId)

        // If dropped on a task (not the column itself), reorder
        if (overTaskIndex !== -1 && oldIndex !== overTaskIndex) {
          const newOrder = arrayMove(taskIds, oldIndex, overTaskIndex)
          const storedOrder = loadStoredOrder()
          storedOrder[sourceColumnName] = newOrder
          saveStoredOrder(storedOrder)
        }
        return
      }

      // Cross-column move: change task status
      const targetStatus = statusByName.get(targetColumnName)
      if (!targetStatus || !targetStatus.id) return

      onStatusChange(taskId, targetStatus)

      // Update stored order: remove from source, add to target
      const storedOrder = loadStoredOrder()

      // Remove from source column order
      const sourceOrder = storedOrder[sourceColumnName] ?? []
      storedOrder[sourceColumnName] = sourceOrder.filter((id) => id !== taskId)

      // Add to target column order
      const targetOrder = storedOrder[targetColumnName] ?? []
      const overTaskIndex = targetOrder.indexOf(overId)
      if (overTaskIndex !== -1) {
        // Insert near the drop target
        targetOrder.splice(overTaskIndex, 0, taskId)
      } else {
        // Append at the end
        targetOrder.push(taskId)
      }
      storedOrder[targetColumnName] = targetOrder

      saveStoredOrder(storedOrder)
    },
    [
      tasks,
      onStatusChange,
      statusByName,
      columnNames,
      taskColumnMap,
      columns,
      t,
    ],
  )

  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
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
