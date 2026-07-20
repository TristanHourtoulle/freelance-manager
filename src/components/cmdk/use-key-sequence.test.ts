import { renderHook } from "@testing-library/react"
import { act } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isEditableTarget, useKeySequence } from "./use-key-sequence"

function press(
  key: string,
  target?: EventTarget,
  init: KeyboardEventInit = {},
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  act(() => {
    ;(target ?? window).dispatchEvent(event)
  })
}

describe("useKeySequence", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ""
  })

  it("fires the handler once for g then d", () => {
    const gd = vi.fn()
    renderHook(() => useKeySequence({ gd }))
    press("g")
    press("d")
    expect(gd).toHaveBeenCalledTimes(1)
  })

  it("fires nothing for an unbound second key", () => {
    const gd = vi.fn()
    renderHook(() => useKeySequence({ gd }))
    press("g")
    press("x")
    expect(gd).not.toHaveBeenCalled()
  })

  it("fires nothing once the sequence timed out", () => {
    const gd = vi.fn()
    renderHook(() => useKeySequence({ gd }, 500))
    press("g")
    act(() => {
      vi.advanceTimersByTime(600)
    })
    press("d")
    expect(gd).not.toHaveBeenCalled()
  })

  it("fires nothing while an input is the event target", () => {
    const gd = vi.fn()
    renderHook(() => useKeySequence({ gd }))
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()
    press("g", input)
    press("d", input)
    expect(gd).not.toHaveBeenCalled()
  })

  it("fires nothing while a textarea is the event target", () => {
    const gd = vi.fn()
    renderHook(() => useKeySequence({ gd }))
    const textarea = document.createElement("textarea")
    document.body.appendChild(textarea)
    press("g", textarea)
    press("d", textarea)
    expect(gd).not.toHaveBeenCalled()
  })

  it("fires nothing while a contenteditable element is the event target", () => {
    const gd = vi.fn()
    renderHook(() => useKeySequence({ gd }))
    const div = document.createElement("div")
    div.contentEditable = "true"
    Object.defineProperty(div, "isContentEditable", { value: true })
    document.body.appendChild(div)
    press("g", div)
    press("d", div)
    expect(gd).not.toHaveBeenCalled()
  })

  it("ignores a sequence started with a modifier", () => {
    const gd = vi.fn()
    renderHook(() => useKeySequence({ gd }))
    press("g", undefined, { metaKey: true })
    press("d")
    expect(gd).not.toHaveBeenCalled()
  })

  it("removes its listener on unmount", () => {
    const gd = vi.fn()
    const { unmount } = renderHook(() => useKeySequence({ gd }))
    unmount()
    press("g")
    press("d")
    expect(gd).not.toHaveBeenCalled()
  })
})

describe("isEditableTarget", () => {
  it("returns false for null", () => {
    expect(isEditableTarget(null)).toBe(false)
  })

  it("returns true for a select element", () => {
    expect(isEditableTarget(document.createElement("select"))).toBe(true)
  })

  it("returns false for a plain div", () => {
    expect(isEditableTarget(document.createElement("div"))).toBe(false)
  })
})
