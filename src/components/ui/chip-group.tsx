"use client"

import { cn } from "@/lib/utils"

const SHAPE_STYLES: Record<string, React.CSSProperties> = {
  first: { borderRadius: "19px 12px 12px 19px" },
  middle: { borderRadius: "12px" },
  last: { borderRadius: "12px 19px 19px 12px" },
  only: { borderRadius: "9999px" },
}

interface ChipProps {
  label: string
  isActive?: boolean
  onClick?: () => void
  position?: "first" | "middle" | "last" | "only"
  className?: string
  children?: React.ReactNode
}

/**
 * Single filter chip with stadium-style border radius based on position.
 * First chip gets pill-left, last gets pill-right, middle gets rounded-xl.
 */
export function Chip({
  label,
  isActive = false,
  onClick,
  position = "middle",
  className,
  children,
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={SHAPE_STYLES[position]}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-2.5 border px-5 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-linear-to-r from-[#2563eb] to-[#1442a9] border-transparent text-white"
          : "bg-surface border-border text-text-secondary hover:border-primary/40 hover:text-text-primary",
        className,
      )}
    >
      {children ?? label}
    </button>
  )
}

interface ChipGroupItem {
  value: string
  label: string
}

interface ChipGroupProps {
  items: readonly ChipGroupItem[]
  selected: string[]
  onToggle: (value: string) => void
  className?: string
}

/**
 * Group of filter chips with automatic stadium-shape positioning.
 * First item gets pill-left border, last gets pill-right, middle items get rounded-xl.
 */
export function ChipGroup({
  items,
  selected,
  onToggle,
  className,
}: ChipGroupProps) {
  function getPosition(
    index: number,
    total: number,
  ): "first" | "middle" | "last" | "only" {
    if (total === 1) return "only"
    if (index === 0) return "first"
    if (index === total - 1) return "last"
    return "middle"
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {items.map((item, index) => (
        <Chip
          key={item.value}
          label={item.label}
          isActive={selected.includes(item.value)}
          onClick={() => onToggle(item.value)}
          position={getPosition(index, items.length)}
        />
      ))}
    </div>
  )
}
