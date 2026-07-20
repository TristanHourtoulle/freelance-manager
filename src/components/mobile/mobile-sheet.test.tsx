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

  it("falls back to an aria-label when no title is provided", () => {
    render(
      <MobileSheet onClose={vi.fn()}>
        <button>Action</button>
      </MobileSheet>,
    )
    const dialog = screen.getByRole("dialog")
    expect(dialog).not.toHaveAttribute("aria-labelledby")
    expect(dialog).toHaveAttribute("aria-label", "Fenêtre modale")
  })

  it("uses the provided ariaLabel when no title is present", () => {
    render(
      <MobileSheet onClose={vi.fn()} ariaLabel="Détail facture">
        <button>Action</button>
      </MobileSheet>,
    )
    expect(screen.getByRole("dialog")).toHaveAttribute(
      "aria-label",
      "Détail facture",
    )
  })

  it("wires aria-describedby to the description node", () => {
    render(
      <MobileSheet onClose={vi.fn()} title="Titre" description="Sous-titre">
        <button>Action</button>
      </MobileSheet>,
    )
    const dialog = screen.getByRole("dialog")
    const describedBy = dialog.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)).toHaveTextContent(
      "Sous-titre",
    )
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

  it("closes only the innermost sheet when Escape is pressed on a nested sheet", () => {
    const closeOuter = vi.fn()
    const closeInner = vi.fn()

    function Nested({ innerOpen }: { innerOpen: boolean }) {
      return (
        <MobileSheet onClose={closeOuter} title="Facture">
          <button>Extérieur</button>
          {innerOpen && (
            <MobileSheet onClose={closeInner} title="Paiement partiel">
              <button>Intérieur</button>
            </MobileSheet>
          )}
        </MobileSheet>
      )
    }

    const { rerender } = render(<Nested innerOpen={false} />)
    rerender(<Nested innerOpen />)

    fireEvent.keyDown(document, { key: "Escape" })
    expect(closeInner).toHaveBeenCalledTimes(1)
    expect(closeOuter).not.toHaveBeenCalled()

    rerender(<Nested innerOpen={false} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(closeOuter).toHaveBeenCalledTimes(1)
    expect(closeInner).toHaveBeenCalledTimes(1)
  })

  it("keeps the Tab focus trap inside the innermost sheet", () => {
    render(
      <MobileSheet onClose={vi.fn()} title="Facture">
        <button>Extérieur</button>
        <MobileSheet onClose={vi.fn()} title="Paiement partiel">
          <button>Premier</button>
          <button>Dernier</button>
        </MobileSheet>
      </MobileSheet>,
    )
    screen.getByRole("button", { name: "Dernier" }).focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Premier" }),
    )
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
