"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
 * Supports keyboard navigation (arrow keys, Enter, Escape).
 */
export function TaskStatusPicker({
  currentStatus,
  availableStatuses,
  onStatusChange,
}: TaskStatusPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
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

  const handleOpen = useCallback(() => {
    setIsOpen(true)
    setFocusedIndex(sortedStatuses.findIndex((s) => s.id === currentStatus.id))
  }, [sortedStatuses, currentStatus.id])

  // Position the dropdown relative to the trigger button (fixed positioning)
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
    })
  }, [isOpen])

  // Focus the dropdown when it opens
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      dropdownRef.current.focus()
    }
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

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          e.preventDefault()
          setIsOpen(false)
          triggerRef.current?.focus()
          break
        case "ArrowDown":
          e.preventDefault()
          setFocusedIndex((prev) =>
            prev < sortedStatuses.length - 1 ? prev + 1 : 0,
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : sortedStatuses.length - 1,
          )
          break
        case "Enter":
        case " ":
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < sortedStatuses.length) {
            const status = sortedStatuses[focusedIndex]
            if (status) handleSelect(status)
          }
          break
      }
    },
    [sortedStatuses, focusedIndex, handleSelect],
  )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="cursor-pointer"
      >
        <TaskStatusBadge status={currentStatus} />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Task status"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            className="fixed min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95 outline-none"
            style={{
              top: position.top,
              left: position.left,
              zIndex: 9999,
            }}
          >
            {sortedStatuses.map((status, index) => (
              <button
                key={status.id}
                type="button"
                role="option"
                aria-selected={status.id === currentStatus.id}
                onClick={() => handleSelect(status)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
                  status.id === currentStatus.id
                    ? "bg-accent/50 font-medium"
                    : ""
                } ${focusedIndex === index ? "bg-accent" : ""}`}
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
