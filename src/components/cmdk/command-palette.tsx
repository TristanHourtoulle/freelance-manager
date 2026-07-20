"use client"

import {
  Activity,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Icon, type IconName } from "@/components/ui/icon"

export interface CommandItem {
  id: string
  label: string
  hint?: string
  group?: string
  icon?: IconName
  shortcut?: string[]
  keywords?: string[]
  tag?: string
  sticky?: boolean
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: CommandItem[]
  placeholder?: string
  onQueryChange?: (query: string) => void
}

function fuzzyScore(text: string, q: string): number {
  if (!q) return 1
  const lt = text.toLowerCase()
  const lq = q.toLowerCase()
  if (lt.includes(lq)) return 100 - lt.indexOf(lq)
  let ti = 0,
    qi = 0,
    score = 0,
    streak = 0
  while (ti < lt.length && qi < lq.length) {
    if (lt[ti] === lq[qi]) {
      qi++
      streak++
      score += 1 + streak
    } else {
      streak = 0
    }
    ti++
  }
  return qi === lq.length ? score : 0
}

interface IndexedCommand extends CommandItem {
  flatIndex: number
}

interface Group {
  label: string
  items: IndexedCommand[]
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const INPUT_LABEL = "Rechercher une commande"

/**
 * Linear/Raycast-style command palette. Mount once at the app root and
 * drive `open` via {@link useCommandPalette}.
 *
 * Each command has a `run` that fires on Enter/click. Use `keywords` for
 * extra fuzzy hits and `group` to label sections.
 */
export function CommandPalette({
  open,
  onClose,
  commands,
  placeholder = "Tape une commande ou cherche…",
  onQueryChange,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const modalRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const itemsRef = useRef(new Map<number, HTMLButtonElement>())
  const baseId = useId()
  const listId = `${baseId}-list`

  const optionIdFor = useCallback(
    (cmd: CommandItem) => `${baseId}-option-${cmd.id}`,
    [baseId],
  )

  useEffect(() => {
    if (!open) return
    setQuery("")
    setActive(0)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (open) return
    const trigger = triggerRef.current
    triggerRef.current = null
    trigger?.focus()
  }, [open])

  useEffect(() => {
    onQueryChange?.(query)
  }, [query, onQueryChange])

  const grouped = useMemo<Group[]>(() => {
    const matchable = commands.filter((c) => !c.sticky)
    const scored = !query.trim()
      ? matchable
      : matchable
          .map((c) => {
            const hay = [c.label, c.hint, c.group, ...(c.keywords ?? [])]
              .filter(Boolean)
              .join(" ")
            return { cmd: c, score: fuzzyScore(hay, query) }
          })
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((x) => x.cmd)
    const ordered = [...scored, ...commands.filter((c) => c.sticky)]

    const buckets: { label: string; items: CommandItem[] }[] = []
    const map = new Map<string, { label: string; items: CommandItem[] }>()
    for (const cmd of ordered) {
      const key = cmd.group ?? "Général"
      let g = map.get(key)
      if (!g) {
        g = { label: key, items: [] }
        map.set(key, g)
        buckets.push(g)
      }
      g.items.push(cmd)
    }

    let flatIdx = 0
    return buckets.map((g) => ({
      label: g.label,
      items: g.items.map((cmd) => ({ ...cmd, flatIndex: flatIdx++ })),
    }))
  }, [commands, query])

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped])
  const activeCommand = flat[active]

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, flat.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const cmd = flat[active]
        if (cmd) {
          cmd.run()
          onClose()
        }
      } else if (e.key === "Tab") {
        const modal = modalRef.current
        if (!modal) return
        const focusables = Array.from(
          modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.tabIndex >= 0)
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!first || !last) {
          e.preventDefault()
          return
        }
        const activeElement = document.activeElement
        if (e.shiftKey) {
          if (activeElement === first || !modal.contains(activeElement)) {
            e.preventDefault()
            last.focus()
          }
        } else if (activeElement === last || !modal.contains(activeElement)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, flat, active, onClose])

  useEffect(() => {
    const el = itemsRef.current.get(active)
    const list = listRef.current
    if (!el || !list) return
    const c = list.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (r.top < c.top) list.scrollTop -= c.top - r.top + 6
    else if (r.bottom > c.bottom) list.scrollTop += r.bottom - c.bottom + 6
  }, [active])

  const setItemRef = useCallback(
    (idx: number) => (el: HTMLButtonElement | null) => {
      if (el) itemsRef.current.set(idx, el)
      else itemsRef.current.delete(idx)
    },
    [],
  )

  return (
    <Activity mode={open ? "visible" : "hidden"}>
      <div
        className={"cmdk-root" + (open ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div className="cmdk-backdrop" onClick={onClose} />
        <div
          ref={modalRef}
          className="cmdk-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cmdk-glow" />
          <div className="cmdk-search">
            <span className="cmdk-search-icon">
              <Icon name="search" size={18} />
            </span>
            <input
              ref={inputRef}
              className="cmdk-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              placeholder={placeholder}
              spellCheck={false}
              autoComplete="off"
              type="text"
              role="combobox"
              aria-label={INPUT_LABEL}
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeCommand ? optionIdFor(activeCommand) : undefined
              }
            />
            <div className="cmdk-kbd-hint">
              <span className="cmdk-kbd">esc</span>
            </div>
          </div>

          <div
            className="cmdk-list"
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={INPUT_LABEL}
          >
            {flat.length === 0 ? (
              <div className="cmdk-empty">
                <div className="cmdk-empty-glyph">
                  <Icon name="search" size={22} />
                </div>
                <div className="cmdk-empty-title">Aucun résultat</div>
                <div className="cmdk-empty-sub">
                  Essaie avec un autre mot-clé.
                </div>
              </div>
            ) : (
              grouped.map((g) => (
                <CmdGroup
                  key={g.label}
                  group={g}
                  activeIndex={active}
                  onHover={setActive}
                  onSelect={(c) => {
                    c.run()
                    onClose()
                  }}
                  registerRef={setItemRef}
                  optionIdFor={optionIdFor}
                />
              ))
            )}
          </div>

          <div className="sr-only" aria-live="polite" role="status">
            {flat.length === 0
              ? "Aucun résultat"
              : `${flat.length} résultat${flat.length > 1 ? "s" : ""} disponible${flat.length > 1 ? "s" : ""}`}
          </div>

          <div className="cmdk-footer">
            <div className="cmdk-footer-left">
              <span className="cmdk-footer-brand-mark">F</span>
              <span>FreelanceManager · ⌘K</span>
            </div>
            <div className="cmdk-footer-actions">
              <span className="cmdk-footer-action">
                <span className="cmdk-kbd">↑</span>
                <span className="cmdk-kbd">↓</span> naviguer
              </span>
              <span className="cmdk-footer-action">
                <span className="cmdk-kbd">↵</span> ouvrir
              </span>
              <span className="cmdk-footer-action">
                <span className="cmdk-kbd">esc</span> fermer
              </span>
            </div>
          </div>
        </div>
      </div>
    </Activity>
  )
}

interface CmdGroupProps {
  group: Group
  activeIndex: number
  onHover: (idx: number) => void
  onSelect: (cmd: CommandItem) => void
  registerRef: (idx: number) => (el: HTMLButtonElement | null) => void
  optionIdFor: (cmd: CommandItem) => string
}

function CmdGroup({
  group,
  activeIndex,
  onHover,
  onSelect,
  registerRef,
  optionIdFor,
}: CmdGroupProps) {
  return (
    <div role="group" aria-label={group.label}>
      <div className="cmdk-group-label" aria-hidden="true">
        <span>{group.label}</span>
        <span className="cmdk-group-count">{group.items.length}</span>
      </div>
      {group.items.map((c) => (
        <CmdRow
          key={c.id}
          cmd={c}
          isActive={activeIndex === c.flatIndex}
          onHover={() => onHover(c.flatIndex)}
          onSelect={() => onSelect(c)}
          registerRef={registerRef(c.flatIndex)}
          optionId={optionIdFor(c)}
        />
      ))}
    </div>
  )
}

interface CmdRowProps {
  cmd: IndexedCommand
  isActive: boolean
  onHover: () => void
  onSelect: () => void
  registerRef: (el: HTMLButtonElement | null) => void
  optionId: string
}

function CmdRow({
  cmd,
  isActive,
  onHover,
  onSelect,
  registerRef,
  optionId,
}: CmdRowProps) {
  return (
    <button
      type="button"
      id={optionId}
      role="option"
      aria-selected={isActive}
      tabIndex={-1}
      ref={registerRef}
      className={"cmdk-item" + (isActive ? " active" : "")}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <span className="cmdk-item-icon">
        <Icon name={cmd.icon ?? "list"} size={15} />
      </span>
      <span className="cmdk-item-body">
        <span className="cmdk-item-label">
          {cmd.label}
          {cmd.tag && <span className="cmdk-tag cmdk-tag-new">{cmd.tag}</span>}
        </span>
        {cmd.hint && <span className="cmdk-item-hint">{cmd.hint}</span>}
      </span>
      <span className="cmdk-item-meta">
        {cmd.shortcut && (
          <span className="cmdk-item-shortcut">
            {cmd.shortcut.map((k, i) => (
              <span key={i} className="cmdk-kbd">
                {k}
              </span>
            ))}
          </span>
        )}
        <span className="cmdk-item-enter">
          <Icon name="arrow-right" size={14} />
        </span>
      </span>
    </button>
  )
}
