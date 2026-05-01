"use client"

import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { fmtEURprecise } from "@/lib/format"

interface EditableTotalProps {
  value: number
  hasOverride: boolean
  onSet: (amount: number) => void
  onClear: () => void
}

/**
 * Click-to-edit total amount.
 *
 * Default state shows a clickable amount with a subtle "edit" icon. Clicking
 * it switches to an inline input. Pressing Enter (or blurring) commits the
 * value via {@link EditableTotalProps.onSet}. The X icon (visible only when
 * an override is currently active) clears the override via
 * {@link EditableTotalProps.onClear}.
 */
export function EditableTotal({
  value,
  hasOverride,
  onSet,
  onClear,
}: EditableTotalProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(String(value || ""))
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    }
  }, [editing, value])

  function commit() {
    const n = Number(draft)
    if (!Number.isNaN(n) && n >= 0) onSet(n)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Cliquer pour saisir un montant forfaitaire"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 6px",
          borderRadius: 5,
          background: hasOverride ? "var(--accent-soft)" : "transparent",
          color: hasOverride ? "var(--accent)" : "var(--text-0)",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontFeatureSettings: '"tnum" 1',
          fontWeight: 600,
        }}
      >
        {fmtEURprecise(value)}
        <Icon
          name="edit"
          size={11}
          style={{ opacity: hasOverride ? 1 : 0.4 }}
        />
      </button>
    )
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "var(--bg-0)",
        border: "1px solid var(--accent)",
        borderRadius: 5,
        padding: "2px 4px",
      }}
    >
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          else if (e.key === "Escape") setEditing(false)
        }}
        style={{
          background: "transparent",
          border: "none",
          outline: "none",
          color: "var(--text-0)",
          fontFamily: "var(--font-mono)",
          fontWeight: 600,
          width: 100,
          textAlign: "right",
          padding: 0,
        }}
      />
      <span className="muted xs">€</span>
      {hasOverride && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            onClear()
            setEditing(false)
          }}
          title="Réinitialiser au calcul automatique"
          style={{
            display: "grid",
            placeItems: "center",
            width: 18,
            height: 18,
            borderRadius: 4,
            color: "var(--text-2)",
            cursor: "pointer",
          }}
        >
          <Icon name="x" size={11} />
        </button>
      )}
    </span>
  )
}
