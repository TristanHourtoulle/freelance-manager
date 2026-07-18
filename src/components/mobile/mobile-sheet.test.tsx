import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobileSheet } from "./mobile-sheet"

describe("MobileSheet", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn()
    render(
      <MobileSheet onClose={onClose} title="Titre">
        <button>Action</button>
      </MobileSheet>,
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("wires aria-labelledby to the title node when a title is present", () => {
    render(
      <MobileSheet onClose={vi.fn()} title="Titre">
        <button>Action</button>
      </MobileSheet>,
    )
    const dialog = screen.getByRole("dialog")
    const labelId = dialog.getAttribute("aria-labelledby")
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId as string)).toHaveTextContent(
      "Titre",
    )
  })

  it("omits aria-labelledby when no title is provided", () => {
    render(
      <MobileSheet onClose={vi.fn()}>
        <button>Action</button>
      </MobileSheet>,
    )
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-labelledby")
  })

  it("moves initial focus into the sheet", () => {
    render(
      <MobileSheet onClose={vi.fn()} title="Titre">
        <button>Action</button>
      </MobileSheet>,
    )
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Action" }),
    )
  })

  it("restores focus to the previously-focused element on unmount", () => {
    const trigger = document.createElement("button")
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { unmount } = render(
      <MobileSheet onClose={vi.fn()} title="Titre">
        <button>Action</button>
      </MobileSheet>,
    )
    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it("locks body scroll while open and restores it on unmount", () => {
    const { unmount } = render(
      <MobileSheet onClose={vi.fn()} title="Titre">
        <button>Action</button>
      </MobileSheet>,
    )
    expect(document.body.style.overflow).toBe("hidden")
    unmount()
    expect(document.body.style.overflow).toBe("")
  })

  it("traps Tab focus within the sheet", () => {
    render(
      <MobileSheet onClose={vi.fn()} title="Titre">
        <button>First</button>
        <button>Last</button>
      </MobileSheet>,
    )
    const last = screen.getByRole("button", { name: "Last" })
    last.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "First" }),
    )
  })
})
