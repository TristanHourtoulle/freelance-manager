"use client"

import { useEffect, useRef } from "react"
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline"
import {
  useCommandPalette,
  type CommandItem,
} from "@/hooks/use-command-palette"

/**
 * Global command palette overlay for searching pages, actions, clients, and tasks.
 * Opened via keyboard shortcut and rendered in the root layout.
 * Delegates state and keyboard navigation to the useCommandPalette hook.
 */
export function CommandPalette() {
  const {
    isOpen,
    close,
    query,
    setQuery,
    sections,
    allItems,
    activeIndex,
    setActiveIndex,
    executeItem,
    handleKeyDown,
    inputRef,
  } = useCommandPalette()

  const overlayRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen, inputRef])

  useEffect(() => {
    if (!listRef.current) return
    const activeElement = listRef.current.querySelector(
      `[data-index="${activeIndex}"]`,
    )
    if (activeElement) {
      activeElement.scrollIntoView({ block: "nearest" })
    }
  }, [activeIndex])

  if (!isOpen) return null

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) {
      close()
    }
  }

  let globalIndex = -1

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[20vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-lg"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-text-secondary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions, clients, tasks..."
            className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
            role="combobox"
            aria-expanded={allItems.length > 0}
            aria-controls="command-palette-list"
            aria-activedescendant={
              allItems[activeIndex]
                ? `command-item-${allItems[activeIndex].id}`
                : undefined
            }
          />
          <kbd className="rounded border border-border bg-surface-secondary px-1.5 py-0.5 text-xs font-medium text-text-secondary">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          className="max-h-80 overflow-y-auto p-2"
        >
          {sections.length === 0 && query.length > 0 ? (
            <p className="px-3 py-6 text-center text-sm text-text-secondary">
              No results found
            </p>
          ) : (
            sections.map((section) => (
              <div key={section.title} className="mb-2 last:mb-0">
                <p className="px-3 py-1.5 text-xs font-semibold uppercase text-text-secondary">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  globalIndex++
                  const itemIndex = globalIndex
                  return (
                    <CommandPaletteItem
                      key={item.id}
                      item={item}
                      isActive={activeIndex === itemIndex}
                      index={itemIndex}
                      onSelect={() => void executeItem(item)}
                      onHover={() => setActiveIndex(itemIndex)}
                    />
                  )
                })}
              </div>
            ))
          )}

          {sections.length === 0 && query.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-secondary">
              Start typing to search...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

interface CommandPaletteItemProps {
  item: CommandItem
  isActive: boolean
  index: number
  onSelect: () => void
  onHover: () => void
}

function CommandPaletteItem({
  item,
  isActive,
  index,
  onSelect,
  onHover,
}: CommandPaletteItemProps) {
  const Icon = item.icon

  return (
    <div
      id={`command-item-${item.id}`}
      role="option"
      aria-selected={isActive}
      data-index={index}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 ease-in-out ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-text-primary hover:bg-surface-muted"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors duration-500 ease-in-out ${
          isActive ? "text-primary" : "text-text-secondary"
        }`}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.comingSoon && (
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            isActive
              ? "bg-primary/10 text-primary"
              : "bg-surface-secondary text-text-secondary"
          }`}
        >
          Coming soon
        </span>
      )}
    </div>
  )
}
