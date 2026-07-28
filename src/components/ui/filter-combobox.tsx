"use client"

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { Icon } from "@/components/ui/icon"
import { fuzzyScore, normalizeSearchText } from "@/lib/fuzzy-score"

/**
 * A section header inside the FilterCombobox popover; options reference it
 * through their `groupId`.
 */
export interface FilterComboboxGroup {
  id: string
  label: string
}

/**
 * One selectable row of the FilterCombobox.
 */
export interface FilterComboboxOption {
  id: string
  label: string
  groupId?: string
  hint?: string
}

/**
 * Props of the shared FilterCombobox component.
 */
export interface FilterComboboxProps {
  label: string
  options: readonly FilterComboboxOption[]
  groups?: readonly FilterComboboxGroup[]
  selected: readonly string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  emptyLabel?: string
}

interface Section {
  group: FilterComboboxGroup | null
  options: FilterComboboxOption[]
}

/**
 * Generic multi-select filter combobox: a compact trigger button opening a
 * fully custom popover with an accent-insensitive search field and a grouped,
 * keyboard-navigable listbox.
 *
 * Selection is controlled: toggling an option calls `onChange` with the next
 * id array and keeps the popover open. Ids present in `selected` but absent
 * from `options` are preserved by toggles so URL-driven selections survive a
 * partially loaded option list. Follows the WAI-ARIA combobox/listbox
 * pattern: the search input is the combobox, the list is
 * `aria-multiselectable`, rows carry `aria-selected`, and the keyboard
 * highlight travels through `aria-activedescendant`.
 *
 * @param props - Trigger `label`, flat `options` (optionally referencing
 * `groups` section headers), controlled `selected`/`onChange`, and popover
 * `placeholder`/`emptyLabel` copy.
 * @returns The trigger button plus its anchored popover.
 */
export function FilterCombobox({
  label,
  options,
  groups,
  selected,
  onChange,
  placeholder = "Rechercher…",
  emptyLabel = "Aucun résultat",
}: FilterComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef(new Map<number, HTMLDivElement>())
  const baseId = useId()
  const listId = `${baseId}-list`

  const visibleOptions = useMemo(() => {
    const q = normalizeSearchText(query.trim())
    if (!q) return [...options]
    return options.filter(
      (o) =>
        fuzzyScore(
          normalizeSearchText(`${o.label} ${o.hint ?? ""}`.trim()),
          q,
        ) > 0,
    )
  }, [options, query])

  const sections = useMemo<Section[]>(() => {
    const ungrouped = visibleOptions.filter((o) => !o.groupId)
    const result: Section[] =
      ungrouped.length > 0 ? [{ group: null, options: ungrouped }] : []
    for (const group of groups ?? []) {
      const own = visibleOptions.filter((o) => o.groupId === group.id)
      if (own.length > 0) result.push({ group, options: own })
    }
    return result
  }, [visibleOptions, groups])

  const flat = useMemo(() => sections.flatMap((s) => s.options), [sections])
  const activeOption = flat[activeIndex]

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  useEffect(() => {
    const el = optionRefs.current.get(activeIndex)
    const list = listRef.current
    if (!el || !list) return
    const c = list.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.top < c.top) list.scrollTop -= c.top - r.top + 6
    else if (r.bottom > c.bottom) list.scrollTop += r.bottom - c.bottom + 6
  }, [activeIndex])

  function toggleOpen() {
    setOpen((o) => {
      if (o) return false
      setQuery("")
      setActiveIndex(0)
      return true
    })
  }

  function toggleOption(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    )
  }

  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((a) => Math.min(a + 1, flat.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (activeOption) toggleOption(activeOption.id)
    }
  }

  const optionIdFor = (o: FilterComboboxOption) => `${baseId}-opt-${o.id}`
  const count = selected.length

  let flatIndex = -1

  return (
    <div ref={wrapperRef} className="filter-combobox">
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-secondary"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label} ${count}`}
        onClick={toggleOpen}
      >
        <Icon name="filter" size={14} />
        {label}
        <span
          className={
            "filter-combobox-count num" + (count === 0 ? " is-empty" : "")
          }
        >
          {count}
        </span>
        <Icon
          name="chevron-down"
          size={12}
          aria-hidden="true"
          focusable="false"
          className={"muted filter-combobox-chevron" + (open ? " is-open" : "")}
        />
      </button>
      <button
        type="button"
        className={
          "icon-btn filter-combobox-clear" + (count === 0 ? " is-hidden" : "")
        }
        aria-label={`Effacer les filtres ${label}`}
        aria-hidden={count === 0 || undefined}
        tabIndex={count === 0 ? -1 : undefined}
        onClick={() => onChange([])}
      >
        <Icon name="x" size={13} />
      </button>
      {open && (
        <div className="filter-pop">
          <div className="filter-pop-search">
            <Icon name="search" size={13} className="muted" />
            <input
              ref={inputRef}
              className="input"
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeOption ? optionIdFor(activeOption) : undefined
              }
              aria-label={placeholder}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={onInputKeyDown}
            />
          </div>
          <div
            ref={listRef}
            id={listId}
            className="filter-pop-list"
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
          >
            {flat.length === 0 && (
              <div className="filter-pop-empty">{emptyLabel}</div>
            )}
            {sections.map((section) => {
              const rows = section.options.map((o) => {
                flatIndex += 1
                const idx = flatIndex
                const isSelected = selected.includes(o.id)
                return (
                  <div
                    key={o.id}
                    ref={(el) => {
                      if (el) optionRefs.current.set(idx, el)
                      else optionRefs.current.delete(idx)
                    }}
                    id={optionIdFor(o)}
                    role="option"
                    aria-selected={isSelected}
                    className={
                      "filter-option" + (idx === activeIndex ? " active" : "")
                    }
                    onClick={() => toggleOption(o.id)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <span className="filter-option-label">{o.label}</span>
                    {o.hint && (
                      <span className="filter-option-hint">{o.hint}</span>
                    )}
                  </div>
                )
              })
              return section.group ? (
                <div
                  key={section.group.id}
                  role="group"
                  aria-labelledby={`${baseId}-group-${section.group.id}`}
                >
                  <div
                    id={`${baseId}-group-${section.group.id}`}
                    className="filter-pop-group-label"
                    role="presentation"
                  >
                    {section.group.label}
                  </div>
                  {rows}
                </div>
              ) : (
                <div key="ungrouped" role="presentation">
                  {rows}
                </div>
              )
            })}
          </div>
          {count > 0 && (
            <div className="filter-pop-footer">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onChange([])}
              >
                <Icon name="x" size={12} />
                Tout effacer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
