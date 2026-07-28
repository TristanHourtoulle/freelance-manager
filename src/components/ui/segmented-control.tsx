import type { CSSProperties } from "react"
import { Icon, type IconName } from "@/components/ui/icon"

/**
 * One selectable option of a SegmentedControl.
 */
export interface SegmentedControlOption<T extends string> {
  id: T
  label: string
  count?: number
  icon?: IconName
}

/**
 * Props for the shared SegmentedControl component.
 */
export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedControlOption<T>[]
  value: T
  onChange: (id: T) => void
  variant?: "accent" | "neutral"
  size?: "sm" | "md"
  scrollable?: boolean
  label?: string
  labelledBy?: string
  className?: string
  style?: CSSProperties
}

/**
 * Pill-shaped segmented control shared by every toggle group in the app.
 *
 * @param props - Options, controlled `value`/`onChange`, and presentation
 * modifiers. `variant="neutral"` (default) fills the active option with bg-3;
 * `variant="accent"` uses the accent pill. `scrollable` stops the buttons
 * from stretching and lets the group scroll horizontally (hidden scrollbar)
 * so 5-6 options survive narrow viewports. Options carrying an `icon` render
 * icon-only and expose their label through `aria-label`. Options carrying a
 * `count` expose "label count" as accessible name so the badge is announced
 * as a separate word.
 * @returns A `role="group"` element whose buttons report selection via
 * `aria-pressed`
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "neutral",
  size = "md",
  scrollable = false,
  label,
  labelledBy,
  className,
  style,
}: SegmentedControlProps<T>) {
  const containerClassName = [
    "seg",
    variant === "accent" ? "seg-accent" : null,
    size === "sm" ? "seg-sm" : null,
    scrollable ? "seg-scroll" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <div
      className={containerClassName}
      role="group"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      style={style}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={option.id === value ? "active" : undefined}
          aria-pressed={option.id === value}
          aria-label={
            option.icon
              ? option.label
              : option.count !== undefined
                ? `${option.label} ${option.count}`
                : undefined
          }
          onClick={() => onChange(option.id)}
        >
          {option.icon ? <Icon name={option.icon} size={14} /> : option.label}
          {option.count !== undefined && (
            <span className="count num">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
