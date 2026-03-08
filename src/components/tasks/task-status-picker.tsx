"use client"

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react"
import { createPortal } from "react-dom"

import { TaskStatusBadge } from "./task-status-badge"
import type { TaskStatusDTO } from "./types"

interface TaskStatusPickerProps {
  currentStatus: TaskStatusDTO
  availableStatuses: TaskStatusDTO[]
  onStatusChange: (newStatus: TaskStatusDTO) => void
}

/** Status type ordering for the dropdown list. */
const STATUS_TYPE_ORDER: Record<string, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  cancelled: 4,
}

/**
 * Clickable status badge that opens a portal-rendered dropdown to change the task status.
 */
export function TaskStatusPicker({
  currentStatus,
  availableStatuses,
  onStatusChange,
}: TaskStatusPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  const sortedStatuses = [...availableStatuses].sort((a, b) => {
    const orderA = STATUS_TYPE_ORDER[a.type] ?? 999
    const orderB = STATUS_TYPE_ORDER[b.type] ?? 999
    return orderA - orderB
  })

  const handleSelect = useCallback(
    (status: TaskStatusDTO) => {
      setIsOpen(false)
      if (status.id === currentStatus.id) return
      onStatusChange(status)
    },
    [currentStatus.id, onStatusChange],
  )

  // Position the dropdown relative to the trigger button
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
    })
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return
      }
      setIsOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false)
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="cursor-pointer"
      >
        <TaskStatusBadge status={currentStatus} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
            style={{
              top: position.top,
              left: position.left,
              zIndex: 9999,
              position: "absolute",
            }}
          >
            {sortedStatuses.map((status) => (
              <button
                key={status.id}
                type="button"
                onClick={() => handleSelect(status)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
                  status.id === currentStatus.id
                    ? "bg-accent/50 font-medium"
                    : ""
                }`}
              >
                <TaskStatusBadge status={status} />
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
