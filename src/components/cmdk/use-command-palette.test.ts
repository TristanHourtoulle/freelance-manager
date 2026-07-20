import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  useCommandPalette,
  useKeySequence,
} from "@/components/cmdk/use-command-palette"

function makeInput(): HTMLInputElement {
  const el = document.createElement("input")
  document.body.appendChild(el)
  return el
}

function press(key: string, target: EventTarget = document.body): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
  })
}

function pressMetaK(target: EventTarget = document.body): void {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    )
  })
}

afterEach(() => {
  document.body.innerHTML = ""
  vi.useRealTimers()
})

describe("useCommandPalette", () => {
  it("opens on ⌘K when the target is the document body", () => {
    const { result } = renderHook(() => useCommandPalette())
    expect(result.current.open).toBe(false)
    pressMetaK()
    expect(result.current.open).toBe(true)
  })

  it("ignores ⌘K fired from an input while closed", () => {
    const { result } = renderHook(() => useCommandPalette())
    pressMetaK(makeInput())
    expect(result.current.open).toBe(false)
  })

  it("still closes on ⌘K fired from an input while open", () => {
    const { result } = renderHook(() => useCommandPalette())
    pressMetaK()
    expect(result.current.open).toBe(true)
    pressMetaK(makeInput())
    expect(result.current.open).toBe(false)
  })
})

describe("useKeySequence", () => {
  it("calls onMatch once after the full sequence", () => {
    const onMatch = vi.fn()
    renderHook(() => useKeySequence(["g", "d"], onMatch, false))
    press("g")
    press("d")
    expect(onMatch).toHaveBeenCalledTimes(1)
  })

  it("ignores keys typed inside an input", () => {
    const onMatch = vi.fn()
    renderHook(() => useKeySequence(["g", "d"], onMatch, false))
    const input = makeInput()
    press("g", input)
    press("d", input)
    expect(onMatch).not.toHaveBeenCalled()
  })

  it("never fires while disabled", () => {
    const onMatch = vi.fn()
    renderHook(() => useKeySequence(["g", "d"], onMatch, true))
    press("g")
    press("d")
    expect(onMatch).not.toHaveBeenCalled()
  })

  it("resets the pending prefix after the timeout", () => {
    vi.useFakeTimers()
    const onMatch = vi.fn()
    renderHook(() => useKeySequence(["g", "d"], onMatch, false))
    press("g")
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    press("d")
    expect(onMatch).not.toHaveBeenCalled()
  })

  it("does not fire when an unrelated key interrupts the sequence", () => {
    const onMatch = vi.fn()
    renderHook(() => useKeySequence(["g", "d"], onMatch, false))
    press("g")
    press("x")
    press("d")
    expect(onMatch).not.toHaveBeenCalled()
  })
})
