export interface QuickDueOption {
  id: "today" | "tomorrow" | "monday"
  label: string
  date: Date
}

const MONDAY = 1

function atLocalMidnight(reference: Date, dayOffset: number): Date {
  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() + dayOffset,
    0,
    0,
    0,
    0,
  )
}

/**
 * Build the three due-date shortcuts offered by quick capture.
 *
 * @param now - Reference instant, normally `new Date()`.
 * @returns Today, tomorrow, and the next Monday strictly after `now`, each at
 * local midnight.
 */
export function quickDueOptions(now: Date): QuickDueOption[] {
  const daysUntilMonday = (MONDAY - now.getDay() + 7) % 7 || 7
  return [
    { id: "today", label: "Aujourd'hui", date: atLocalMidnight(now, 0) },
    { id: "tomorrow", label: "Demain", date: atLocalMidnight(now, 1) },
    {
      id: "monday",
      label: "Lundi",
      date: atLocalMidnight(now, daysUntilMonday),
    },
  ]
}

/**
 * Format a date as a local `YYYY-MM-DD` string.
 *
 * @param date - Date to format, interpreted in the local timezone.
 * @returns The calendar day of `date` as seen locally, never shifted by UTC.
 */
export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
